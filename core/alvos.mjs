// alvos.mjs — o registro de alvos da máquina (H9, H21; spec/instalacao.md). Fica fora de qualquer git, porque cita
// caminhos de repos da empresa: a lista (alvos.json) é escrita só pela CLI; as regras por pasta (regras.yaml) são da
// pessoa e negadas ao agente. A fronteira efetiva de um alvo é a mais restrita entre a declarada no sistema.yaml e
// todas as regras que casam; sem nenhuma, vale cliente (fail-closed). O registro só lista e só aperta: as guardas
// moram no alvo, e nada aqui muda o comportamento dentro dele (a composição em 3 níveis é do médio prazo).
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync, lstatSync } from "node:fs";
import { join, resolve, isAbsolute, basename } from "node:path";
import { randomBytes } from "node:crypto";
import { parseYaml } from "./yaml.mjs";
import { modoRoot } from "./root.mjs";
import { real } from "./protegidos.mjs";

export const FRONTEIRAS = ["pessoal", "empresa", "cliente"]; // da mais solta para a mais restrita (cliente é a mais, D35)
const rank = (f) => FRONTEIRAS.indexOf(f);
export const maisRestrita = (...fs) => fs.filter((f) => FRONTEIRAS.includes(f)).reduce((a, b) => (a === null || rank(b) > rank(a) ? b : a), null);

// A lista mora na pasta da cópia fixada da pessoa (o uid dela escreve); as regras, ali e, no modo root, também na raiz
// do root (só o root escreve; as duas valem juntas, e mais regra só aperta).
export function caminhosDoRegistro(ctx) {
  if (!ctx.home) return null;
  const pasta = join(ctx.home, ".local", "share", "zeno");
  const m = modoRoot(ctx);
  return { pasta, alvos: join(pasta, "alvos.json"), regras: [join(pasta, "regras.yaml"), ...(m ? [join(m.raiz, "regras.yaml")] : [])] };
}

// O arquivo do registro que o agente não edita por ferramenta de arquivo (regras e lista; a guarda está em guarda.mjs).
export function arquivoDoRegistro(ctx, arquivo, cwd) {
  const c = caminhosDoRegistro(ctx);
  if (!c || !arquivo) return null;
  const alvo = real(resolve(cwd || ctx.cwd || "/", String(arquivo).replace(/^~(?=\/|$)/, ctx.home)));
  for (const p of [c.alvos, ...c.regras]) if (alvo === real(p)) return p;
  return null;
}

const expandir = (ctx, p) => String(p).replace(/^~(?=\/|$)/, ctx.home || "~");
const reGlob = (glob) => new RegExp("^" + glob.replace(/\/+$/, "").split(/(\*\*|\*)/).map((x) => (x === "**" ? ".*" : x === "*" ? "[^/]*" : x.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))).join("") + "$");

// Lê a lista. { alvos: [{caminho, nome, registrado}], erro } — sem arquivo é lista vazia; ilegível é erro (e a frota para).
export function lerLista(ctx) {
  const c = caminhosDoRegistro(ctx);
  if (!c) return { alvos: [], erro: "sem a pasta da casa (home) no contexto" };
  if (!existsSync(c.alvos)) return { alvos: [], erro: null };
  try {
    const j = JSON.parse(readFileSync(c.alvos, "utf8"));
    if (!j || !Array.isArray(j.alvos) || j.alvos.some((a) => !a || typeof a.caminho !== "string" || !isAbsolute(a.caminho))) throw new Error("formato");
    return { alvos: j.alvos, erro: null };
  } catch { return { alvos: [], erro: `a lista de alvos está ilegível (${c.alvos}); nenhum verbo de frota opera até ela ser refeita (zeno alvos --descobrir)` }; }
}

function gravarLista(ctx, alvos) {
  const c = caminhosDoRegistro(ctx);
  mkdirSync(c.pasta, { recursive: true });
  const tmp = `${c.alvos}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(tmp, JSON.stringify({ zeno: 1, alvos: [...alvos].sort((a, b) => a.caminho.localeCompare(b.caminho)) }, null, 2) + "\n");
  renameSync(tmp, c.alvos); // troca atômica: quem lê nunca vê meio arquivo
}

// Lê as regras. { regras: [{pasta, fronteira, re, arquivo}], erro } — ilegível ou fronteira desconhecida é erro (fail-closed).
export function lerRegras(ctx) {
  const c = caminhosDoRegistro(ctx);
  if (!c) return { regras: [], erro: "sem a pasta da casa (home) no contexto" };
  const regras = [], erros = [];
  for (const arq of c.regras) {
    if (!existsSync(arq)) continue;
    const { obj, errs } = parseYaml(readFileSync(arq, "utf8"), arq);
    if (errs.length) { erros.push(`${arq}: ${errs.map((e) => `linha ${e[1]} ${e[3]}`).join("; ")}`); continue; }
    const r = obj?.regras;
    if (r === null || r === undefined) continue;
    if (typeof r !== "object" || Array.isArray(r)) { erros.push(`${arq}: regras: é um mapa "pasta": fronteira`); continue; }
    for (const [pasta, fronteira] of Object.entries(r)) {
      if (!FRONTEIRAS.includes(fronteira)) { erros.push(`${arq}: fronteira desconhecida em "${pasta}": ${fronteira}`); continue; }
      regras.push({ pasta, fronteira, re: reGlob(expandir(ctx, pasta)), arquivo: arq });
    }
  }
  return { regras, erro: erros.length ? `regras por pasta ilegíveis (${erros.join(" | ")}); nenhum verbo de frota opera até elas serem consertadas` : null };
}

// A fronteira declarada no sistema.yaml do alvo, crua (sem o padrão do core: config.mjs assume pessoal; a H21 não).
function declarada(dir) {
  const p = join(dir, ".agents", "sistema.yaml");
  if (!existsSync(p)) return { existe: false, fronteira: null };
  const { obj } = parseYaml(readFileSync(p, "utf8"), p);
  return { existe: true, fronteira: obj?.fronteira ?? null, nome: obj?.alvo ?? null };
}

// Num worktree ligado, o git-dir não é o common-dir: o alvo recebe pelo merge do checkout principal.
export function ehWorktreeLigado(ctx, dir) {
  if (!ctx.git) return false;
  const r = ctx.git(["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"], { cwd: dir });
  const [g, c] = r.status === 0 ? r.stdout.split("\n") : [];
  return !!(g && c && g !== c);
}

// A fronteira de um caminho só pelas regras (para o install avisar antes de gravar o sistema.yaml).
export function fronteiraDaRegra(ctx, dir, regras = lerRegras(ctx).regras) {
  const casam = regras.filter((r) => r.re.test(real(resolve(dir))) || r.re.test(resolve(dir)));
  return { fronteira: maisRestrita(...casam.map((r) => r.fronteira)), regras: casam.map((r) => r.pasta) };
}

// A vista de cada alvo: o que a frota, as telas e os sensores leem (contrato do zeno alvos --json, spec/cli.md).
export function vistaDosAlvos(ctx) {
  const L = lerLista(ctx), R = lerRegras(ctx), avisos = [];
  if (L.erro) avisos.push({ regra: "registro", msg: L.erro });
  if (R.erro) avisos.push({ regra: "regras", msg: R.erro });
  const alvos = L.alvos.map((a) => {
    const d = declarada(a.caminho), rg = fronteiraDaRegra(ctx, a.caminho, R.regras);
    const decl = FRONTEIRAS.includes(d.fronteira) ? d.fronteira : null;
    const efetiva = maisRestrita(decl, rg.fronteira) ?? "cliente";
    const worktree = d.existe && ehWorktreeLigado(ctx, a.caminho);
    const divergencia = d.existe && d.fronteira !== efetiva;
    const x = {
      caminho: a.caminho, nome: d.nome || a.nome || basename(a.caminho), registrado: a.registrado ?? null,
      declarada: d.fronteira, regra: rg.fronteira, regras: rg.regras, efetiva,
      divergencia, sumiu: !d.existe, worktree,
      // a frota só opera alvo pessoal, presente, no checkout principal, com lista e regras legíveis (fail-closed)
      opera: !L.erro && !R.erro && d.existe && !worktree && efetiva === "pessoal",
    };
    if (divergencia) avisos.push({ regra: "fronteira", msg: `${a.caminho}: declara ${d.fronteira ?? "nada"}, vale ${efetiva}${rg.regras.length ? ` (regra ${rg.regras.join(", ")})` : " (sem regra: o padrão é cliente)"}` });
    return x;
  });
  return { alvos, avisos, registro: caminhosDoRegistro(ctx), erro: L.erro || R.erro || null };
}

// Registra um alvo (o install chama). Devolve { ok, msg }. Nunca lança: o registro não guarda nada, e o install segue.
export function registrarAlvo(ctx, dir, nome) {
  try {
    const c = caminhosDoRegistro(ctx);
    if (!c) return { ok: false, msg: "registro de alvos: sem a pasta da casa; rode zeno alvos --descobrir depois" };
    if (ehWorktreeLigado(ctx, dir)) return { ok: false, msg: "registro de alvos: worktree ligado não entra (recebe pelo merge do checkout principal)" };
    const L = lerLista(ctx);
    if (L.erro) return { ok: false, msg: `registro de alvos: ${L.erro}` };
    const caminho = real(resolve(dir));
    if (L.alvos.some((a) => a.caminho === caminho)) return { ok: true, msg: `registro de alvos: ${caminho} já estava na lista` };
    gravarLista(ctx, [...L.alvos, { caminho, nome, registrado: new Date(ctx.agora ? ctx.agora() : 0).toISOString() }]);
    return { ok: true, msg: `registro de alvos: ${caminho} entrou na lista (${c.alvos})` };
  } catch (e) {
    // ex.: dentro do zeno sessao, a pasta da cópia fica fora do alcance (lancar.mjs)
    return { ok: false, msg: `registro de alvos: não consegui gravar (${e.code || e.message}); rode zeno alvos --descobrir fora da sessão isolada` };
  }
}

// Acha alvos já instalados sob as pastas dadas: não sobe acima delas, não segue link, pula pasta oculta e node_modules,
// e para em 6 níveis (como o laço do scratchpad que isto substitui). Devolve os caminhos achados e os pulados.
const PULA = new Set(["node_modules", ".git", ".github-cache", "_lixo"]);
export function descobrir(ctx, pastas, prof = 6) {
  const achados = [], pulados = [];
  const andar = (d, n) => {
    if (existsSync(join(d, ".agents", "sistema.yaml"))) {
      if (ehWorktreeLigado(ctx, d)) pulados.push({ caminho: d, motivo: "worktree ligado" }); else achados.push(real(d));
    }
    if (n >= prof) return;
    let es; try { es = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) if (e.isDirectory() && !e.isSymbolicLink() && !e.name.startsWith(".") && !PULA.has(e.name)) andar(join(d, e.name), n + 1);
  };
  for (const p of pastas) {
    const d = resolve(ctx.cwd || "/", expandir(ctx, p));
    let st; try { st = lstatSync(d); } catch { pulados.push({ caminho: d, motivo: "não existe" }); continue; }
    if (!st.isDirectory()) { pulados.push({ caminho: d, motivo: "não é pasta" }); continue; }
    andar(d, 0);
  }
  return { achados: [...new Set(achados)], pulados };
}

export function registrarVarios(ctx, caminhos) {
  const L = lerLista(ctx);
  if (L.erro) return { novos: [], erro: L.erro };
  const ja = new Set(L.alvos.map((a) => a.caminho)), ts = new Date(ctx.agora ? ctx.agora() : 0).toISOString();
  const novos = caminhos.filter((c) => !ja.has(c)).map((c) => ({ caminho: c, nome: declarada(c).nome || basename(c), registrado: ts }));
  if (novos.length) gravarLista(ctx, [...L.alvos, ...novos]);
  return { novos: novos.map((n) => n.caminho), erro: null };
}

export function esquecer(ctx, caminhos) {
  const L = lerLista(ctx);
  if (L.erro) return { tirados: [], erro: L.erro };
  const alvo = new Set(caminhos.flatMap((c) => { const r = resolve(ctx.cwd || "/", expandir(ctx, c)); return [r, real(r)]; }));
  const fica = L.alvos.filter((a) => !alvo.has(a.caminho)), tirados = L.alvos.filter((a) => alvo.has(a.caminho)).map((a) => a.caminho);
  if (tirados.length) gravarLista(ctx, fica);
  return { tirados, erro: null };
}
