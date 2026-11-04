// portao.mjs — o portão de publicação (T118). O `zeno promover --publicar <clone>` chama isto depois da prova isolada e
// da passphrase, sem trocar a cópia que guarda. O portão monta um snapshot num diretório temporário: o zeno/ sem dado de
// alvo, as páginas de docs/ da lista fixa (com os links reescritos) e o CHANGELOG gerado dos commits. Tudo sai do
// commit (git archive), não da pasta no disco, com os caminhos do monorepo trocados pelos do repo público (T119). Depois
// roda os 7 checks. Cada um falha fechado: falta de ferramenta, de lista ou de arquivo também reprova. Só com os 7 verdes ele
// escreve o snapshot no clone público, faz o commit e a tag e grava `publicacao.preparada`, assinado. O push é da pessoa.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, lstatSync, renameSync, cpSync, rmSync, realpathSync } from "node:fs";
import { join, dirname, relative, resolve, isAbsolute } from "node:path";
import { ev, gravar, lerLedger } from "./sessao.mjs";
import { travar, destravar } from "./config.mjs";
import { Recusa } from "./util.mjs";
import { aspas } from "./prova.mjs";
import { modoRoot } from "./root.mjs";
import { VERSAO } from "./run.mjs";

// o que nunca entra (no topo do zeno/): estado e harness do alvo, o lixo e os githooks gerados deste monorepo
export const FORA = new Set([".agents", ".claude", "CLAUDE.md", "_lixo", ".githooks", ".git"]);
// a lista do que entra (check 4): tudo o que estiver no snapshot fora dela reprova
export const ENTRA = new Set(["cli.mjs", "core", "bin", "modulos", "test", "guardas.json", "spec", "README.md", "AGENTS.md",
  "LICENSE", "NOTICE", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md", "docs"]);
export const PUBLICOS = ["LICENSE", "NOTICE", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md"];
// as páginas de docs/ que falam do Zeno; o resto da doc (hub, avaliação) fica privado
export const DOCS = ["comecar.md", "conceitos.md", "como-fazer/instalar-num-repo.md", "como-fazer/trabalhar-num-no.md",
  "como-fazer/aprovar-um-gate.md", "como-fazer/quando-algo-e-negado.md", "referencia.md", "glossario.md"];
// os nomes de casa de exemplo que a doc e os testes usam; qualquer outro /home/<nome> reprova
export const CASA_EXEMPLO = new Set(["ana", "pessoa", "usuario", "voce", "exemplo"]);
// a lista de nomes de empresa e cliente é da máquina, fora de qualquer git (nada da empresa é escrito no monorepo)
export const caminhoNomes = (home) => join(home, ".config", "zeno", "portao-nomes.txt");

const dentro = (p, base) => { const r = relative(base, p); return r === "" || (!r.startsWith("..") && !isAbsolute(r)); };
const normal = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ok = (id) => ({ id, ok: true, msg: "" });
const reprova = (id, msg) => ({ id, ok: false, msg });

// Os arquivos do snapshot, relativos e com "/". Link simbólico entra como arquivo para o check 4 o recusar.
export function listar(dir, pre = "") {
  const out = [];
  for (const x of readdirSync(join(dir, pre)).sort()) {
    const rel = pre ? `${pre}/${x}` : x, st = lstatSync(join(dir, rel));
    if (st.isDirectory()) out.push(...listar(dir, rel)); else out.push(rel);
  }
  return out;
}

// O link relativo de uma página aponta para o lugar novo dela no snapshot. Link para fora do que entra (o hub, a
// avaliação, uma página de docs/ fora da lista) vira texto, porque quebraria no público.
export function reescrever(txt, origem, destino, { src, docs }) {
  return txt.replace(/(!?)\[([^\]\n]*)\]\(([^)\s]+)\)/g, (m, img, texto, alvo) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(alvo) || alvo.startsWith("#")) return m;
    const i = alvo.indexOf("#"), cam = i < 0 ? alvo : alvo.slice(0, i), ancora = i < 0 ? "" : alvo.slice(i);
    const abs = resolve(dirname(origem), cam);
    let rel = null;
    if (dentro(abs, src)) { const r = relative(src, abs); if (!FORA.has(r.split("/")[0])) rel = r; }
    else if (DOCS.includes(relative(docs, abs))) rel = `docs/${relative(docs, abs)}`;
    if (rel === null) return texto;
    const novo = relative(join("/", dirname(destino)), join("/", rel)) || ".";
    return `${img}[${texto}](${novo}${cam.endsWith("/") && !novo.endsWith("/") ? "/" : ""}${ancora})`;
  });
}

// T119: a doc vem do monorepo, onde o código mora em zeno/; no repo público ele está na raiz. Uma tabela fixa e pequena
// troca os caminhos no ESCOPO (docs/, bin/, README.md e AGENTS.md); o check 7 (`layout`) reprova o que sobrar ali,
// inclusive frase nova fora dela. A spec e os testes saem como estão: descrevem a própria troca (v0.1.2).
export const ESCOPO = (f) => /^(docs|bin)\//.test(f) || f === "README.md" || f === "AGENTS.md";
export const LAYOUT = [[/\$CE\/zeno\//g, "$CE/"], [/(<caminho do clone>|<repo>)\/zeno(\/|(?=[`\s]|$))/gm, "$1$2"],
  [/`zeno\/bin\/zeno`/g, "`bin/zeno`"], [/clone do (`?)context-engineering(`?)/g, "clone do $1zeno$2"]];
export const SOBRA = [/\$CE\/zeno\//, /\$CE\/avaliacao\//, /clone>\/zeno\b/, /<repo>\/zeno\b/];
export const NOTA = "> Esta página vem do monorepo de origem do Zeno. Onde ela diz `zeno/`, aqui é a raiz deste repositório; a `avaliacao/` e o `conhecimento/` não vêm nesta publicação.\n";
export const SEM_PLACAR = "Esta publicação não traz o placar: ele mora na `avaliacao/` do monorepo de origem.\n";
const AGENTS_PUB = [[/^- Desenho: vault .*\n/m, ""], [/^- Stack: .*\n/m, "- Stack: Node ESM **sem dependências**. As decisões de desenho (D…) ficam fora deste repositório.\n"]];

// O bloco de código que roda algo da avaliacao/ sai, com o bloco de saída logo depois dele, e vira uma frase.
function semPlacar(txt) {
  const ls = txt.split("\n"), out = [];
  for (let i = 0; i < ls.length; i++) {
    if (!ls[i].startsWith("```")) { out.push(ls[i]); continue; }
    let j = i + 1; while (j < ls.length && !ls[j].startsWith("```")) j++;
    if (!ls.slice(i, j).some((l) => l.includes("$CE/avaliacao/"))) { out.push(...ls.slice(i, j + 1)); i = j; continue; }
    if (ls[j + 1]?.startsWith("```text saida")) { j++; while (++j < ls.length && !ls[j].startsWith("```")); }
    out.push(SEM_PLACAR.trimEnd()); i = j;
  }
  return out.join("\n");
}

export function layout(txt, f) {
  if (!ESCOPO(f)) return txt;
  let t = f.startsWith("docs/") ? semPlacar(txt) : txt;
  for (const [de, para] of [...LAYOUT, ...(f === "AGENTS.md" ? AGENTS_PUB : [])]) t = t.replace(de, para);
  if (f.startsWith("docs/")) { const m = /^# .*\n/m.exec(t); t = m ? `${t.slice(0, m.index + m[0].length)}\n${NOTA}${t.slice(m.index + m[0].length)}` : NOTA + "\n" + t; }
  return t;
}

// O CHANGELOG sai dos commits do zeno/ (sem o .agents/) desde a origem da publicação anterior, agrupado por tipo. Na 1ª
// publicação (sem anterior no ledger), sai só o resumo fixo da versão: o público nasce sem histórico, e os assuntos do
// dia a dia podem citar um nome fora da lista da máquina.
export const PRIMEIRA = "Primeira versão pública do Zeno. O histórico de desenvolvimento fica no repositório de origem; a partir da próxima versão, este arquivo lista as mudanças desde a anterior.\n";
export function changelog(ctx, src, commit, desde) {
  const topo = `# Changelog\n\nGerado pelo \`zeno promover --publicar\` a partir dos commits do código.\n\n## v${VERSAO} (${new Date(ctx.agora()).toISOString().slice(0, 10)})\n\n`;
  if (!desde) return topo + PRIMEIRA;
  const r = ctx.git(["log", "--no-merges", "--format=%h%x09%s", `${desde}..${commit}`, "--", ".", ":(exclude).agents"], { cwd: src });
  if (r.status !== 0) return null;
  const grupos = { Novidades: [], "Correções": [], "Outras mudanças": [] };
  for (const l of r.stdout.split("\n").filter(Boolean)) {
    const [h, s = ""] = l.split("\t");
    grupos[/^feat[(!:]/.test(s) ? "Novidades" : /^fix[(!:]/.test(s) ? "Correções" : "Outras mudanças"].push(`- ${s} (${h})`);
  }
  const corpo = Object.entries(grupos).filter(([, ls]) => ls.length).map(([g, ls]) => `### ${g}\n\n${ls.join("\n")}\n`).join("\n");
  return topo + (corpo || "Nenhum commit novo.\n");
}

// O zeno/ e o docs/ do `commit` (git archive) extraídos em `dest`, lado a lado como no monorepo; devolve o zeno/ de lá.
// Nada da árvore de trabalho entra: nem o arquivo ignorado pelo git, nem o não rastreado, nem o que está só no stage.
export function extrairDoCommit(ctx, src, commit, dest) {
  const g = (args, cwd = src) => ctx.git(args, { cwd });
  const topo = g(["rev-parse", "--show-toplevel"]), pre = g(["rev-parse", "--show-prefix"]);
  if (topo.status !== 0 || pre.status !== 0) throw new Recusa(1, "portao", `não consegui ler o git de ${src}: o snapshot sai do commit`);
  const raiz = topo.stdout.trim(), p = pre.stdout.trim().replace(/\/$/, "");
  const caminhos = [p || ".", ...(p && g(["ls-tree", "--name-only", commit, "--", "docs"], raiz).stdout.trim() ? ["docs"] : [])];
  const tar = join(dest, "commit.tar");
  const a = g(["archive", "--format=tar", "-o", tar, commit, "--", ...caminhos], raiz);
  if (a.status !== 0) throw new Recusa(1, "portao", `o git archive de ${commit.slice(0, 12)} falhou: ${String(a.stderr || "").trim()}`);
  if (ctx.rodar(`tar -xf ${aspas(tar)} -C ${aspas(dest)}`, { cwd: dest }).status !== 0) throw new Recusa(1, "portao", "não consegui extrair o commit (tar)");
  return join(dest, p);
}

// Monta o snapshot em `snap`, do `commit` e não da pasta. Devolve o que faltou (página de docs/, CHANGELOG): o check 4
// reprova por isso.
export function montar(ctx, src, snap, { commit, desde }) {
  const tmp = mkdtempSync(join(ctx.tmp || "/tmp", "zeno-commit-"));
  try {
    const raiz = /*G:portao-commit*/ true ? extrairDoCommit(ctx, src, commit, tmp) : src;
    return montarDe(ctx, raiz, snap, { src, commit, desde });
  } finally { rmSync(tmp, { recursive: true, force: true }); } // só a pasta temporária criada acima
}

function montarDe(ctx, raiz, snap, { src: repo, commit, desde }) {
  const src = raiz, docs = join(raiz, "..", "docs"), faltam = [], origem = new Map();
  for (const x of readdirSync(src)) {
    if (FORA.has(x)) continue;
    cpSync(join(src, x), join(snap, x), { recursive: true, dereference: false });
  }
  for (const f of listar(snap)) origem.set(f, join(src, f));
  for (const p of DOCS) {
    if (!existsSync(join(docs, p))) { faltam.push(`docs/${p}`); continue; }
    mkdirSync(dirname(join(snap, "docs", p)), { recursive: true });
    writeFileSync(join(snap, "docs", p), readFileSync(join(docs, p)));
    origem.set(`docs/${p}`, join(docs, p));
  }
  for (const [f, de] of origem) {
    if (!f.endsWith(".md") || lstatSync(join(snap, f)).isSymbolicLink()) continue;
    writeFileSync(join(snap, f), layout(reescrever(readFileSync(join(snap, f), "utf8"), de, f, { src, docs }), f));
  }
  if (existsSync(join(snap, "bin", "zeno")) && !lstatSync(join(snap, "bin", "zeno")).isSymbolicLink())
    writeFileSync(join(snap, "bin", "zeno"), layout(readFileSync(join(snap, "bin", "zeno"), "utf8"), "bin/zeno"));
  const cl = changelog(ctx, repo, commit, desde);
  if (cl === null) faltam.push("CHANGELOG.md (o git log falhou)"); else writeFileSync(join(snap, "CHANGELOG.md"), cl);
  return faltam;
}

const texto = (snap, f) => { try { return readFileSync(join(snap, f), "utf8"); } catch { return ""; } };
const resumo = (xs) => xs.slice(0, 20).join("; ") + (xs.length > 20 ? `; e mais ${xs.length - 20}` : "");

// 1. nenhum nome de empresa ou cliente da lista da máquina, no caminho ou no texto, sem acento e sem caixa. A saída diz
// o número do nome na lista, não o nome (a saída pode ir parar num log).
export function checkNomes(ctx, snap, arquivos) {
  const p = caminhoNomes(ctx.home);
  let nomes = [];
  try { nomes = readFileSync(p, "utf8").split("\n").map((l) => normal(l.trim())).filter((l) => l && !l.startsWith("#")); } catch {}
  if (/*G:portao-nomes*/ !nomes.length) return reprova("nomes", `a lista de nomes ${p} está ausente ou vazia`);
  const achados = [];
  for (const f of arquivos) {
    const linhas = [normal(f), ...normal(texto(snap, f)).split("\n")];
    linhas.forEach((l, k) => nomes.forEach((n, j) => { if (l.includes(n)) achados.push(`${f}${k ? `:${k}` : " (no caminho)"} (nome ${j + 1} da lista)`); }));
  }
  return /*G:portao-nomes*/ achados.length ? reprova("nomes", `nome da lista no snapshot: ${resumo(achados)}`) : ok("nomes");
}

// 2. nenhum caminho de casa real: a casa desta máquina (também na forma com "-" das pastas de projeto do Claude Code)
// e qualquer /home/<nome> ou /Users/<nome> fora dos de exemplo
export function checkCasa(ctx, snap, arquivos) {
  const casa = ctx.home && ctx.home.length > 1 ? ctx.home : null, achados = [];
  const formas = casa ? [casa, casa.replace(/\//g, "-")] : [];
  for (const f of arquivos) {
    texto(snap, f).split("\n").forEach((l, k) => {
      const reais = [...l.matchAll(/\/(?:home|Users)\/([A-Za-z0-9._-]+)/g)].filter((m) => !CASA_EXEMPLO.has(m[1]));
      if (formas.some((x) => l.includes(x)) || reais.length) achados.push(`${f}:${k + 1}`);
    });
  }
  return /*G:portao-casa*/ achados.length ? reprova("casa", `caminho de casa real no snapshot: ${resumo(achados)}`) : ok("casa");
}

// 3. o gitleaks (ferramenta externa, nunca embutida) sai limpo no snapshot; sem ele, reprova
export function checkGitleaks(ctx, snap) {
  if (/*G:portao-gitleaks*/ !ctx.which("gitleaks")) return reprova("gitleaks", "o gitleaks não está no PATH: instale-o (o portão não publica sem ele)");
  const r = ctx.rodar(`gitleaks detect --no-git --source ${aspas(snap)} --no-banner --redact --exit-code 1 2>&1`, { cwd: snap });
  const fim = String(r.stdout || "").trim().split("\n").slice(-8).join("\n");
  return /*G:portao-gitleaks*/ r.status !== 0 ? reprova("gitleaks", `o gitleaks achou segredo ou falhou (saída ${r.status})${fim ? `:\n${fim}` : ""}`) : ok("gitleaks");
}

// 4. nenhum arquivo fora da lista do que entra, nenhum link simbólico, e nada faltando (docs da lista, LICENSE e cia.)
export function checkLista(snap, arquivos, faltam) {
  const fora = arquivos.filter((f) => {
    const partes = f.split("/");
    return !ENTRA.has(partes[0]) || partes.some((x) => FORA.has(x)) || (partes[0] === "docs" && !DOCS.includes(partes.slice(1).join("/")))
      || lstatSync(join(snap, f)).isSymbolicLink();
  });
  const falta = [...faltam, ...PUBLICOS.filter((x) => !arquivos.includes(x) && !faltam.some((y) => y.startsWith(x)))];
  const erros = [...(fora.length ? [`fora da lista: ${resumo(fora)}`] : []), ...(falta.length ? [`faltando: ${resumo(falta)}`] : [])];
  return /*G:portao-lista*/ erros.length ? reprova("lista", erros.join("; ")) : ok("lista");
}

// 5. o clone público é um git limpo e todo commit dele veio do portão (o ledger guarda o commit de cada publicação);
// a tag da versão ainda não existe. Commit que só está no remoto não aparece: a pessoa roda git fetch antes.
export function checkHistorico(ctx, pub, anteriores, tag) {
  const g = (args) => ctx.git(args, { cwd: pub });
  if (!existsSync(pub)) return reprova("historico", `${pub} não existe: clone o repositório público antes`);
  const topo = g(["rev-parse", "--show-toplevel"]);
  if (topo.status !== 0 || realpathSync(topo.stdout.trim() || "/") !== realpathSync(pub)) return reprova("historico", `${pub} não é a raiz de um clone git`);
  const st = g(["status", "--porcelain", "--untracked-files=all"]);
  if (st.status !== 0 || st.stdout.trim()) return reprova("historico", `o clone público tem mudança não commitada:\n${st.stdout.trim()}`);
  const revs = g(["rev-list", "--all"]);
  if (revs.status !== 0) return reprova("historico", "não consegui listar os commits do clone (git rev-list --all)");
  const nossos = new Set(anteriores.map((e) => e.dados?.commit).filter(Boolean));
  const estranhos = revs.stdout.split("\n").filter(Boolean).filter((h) => !nossos.has(h));
  if (/*G:portao-historico*/ estranhos.length) return reprova("historico", `o clone tem ${estranhos.length} commit(s) que não vieram do portão: ${resumo(estranhos.map((h) => h.slice(0, 12)))}; importe-os no monorepo antes`);
  if (g(["tag", "--list", tag]).stdout.trim()) return reprova("historico", `a tag ${tag} já existe no clone`);
  return ok("historico");
}

// 6. a cópia que guarda é a do root (/opt/zeno ativo): a ordem é portão, depois o root, depois a publicação
export function checkRoot(ctx) {
  const m = modoRoot(ctx);
  return /*G:portao-root*/ !(m && existsSync(m.atual)) ? reprova("root", `a cópia do root não está ativa (${ctx.root?.raiz || "/opt/zeno"}): rode antes o bloco C do roteiro da T82`) : ok("root");
}

// 7. nenhum caminho do monorepo sobrando na doc, no README, no AGENTS.md e no bin/ (T119): a tabela LAYOUT não cobriu
export function checkLayout(snap, arquivos) {
  const achados = [];
  for (const f of arquivos.filter(ESCOPO))
    texto(snap, f).split("\n").forEach((l, k) => { if (SOBRA.some((r) => r.test(l))) achados.push(`${f}:${k + 1}`); });
  return /*G:portao-layout*/ achados.length ? reprova("layout", `caminho do monorepo no snapshot: ${resumo(achados)}`) : ok("layout");
}

// O portão inteiro: monta, roda os 7 checks e, só com todos verdes, escreve no clone, faz o commit e a tag e grava o
// evento assinado. A chave já está aberta (o promover a pediu antes da prova).
export async function publicar(S, { src, commit, prova, pub, lixo }) {
  const ctx = S.ctx, tag = `v${VERSAO}`;
  const anteriores = (S.led?.eventos || []).filter((e) => e.ev === "publicacao.preparada");
  const snap = mkdtempSync(join(ctx.tmp || "/tmp", "zeno-publico-"));
  try {
    const faltam = montar(ctx, src, snap, { commit, desde: anteriores.at(-1)?.dados?.origem });
    const arquivos = listar(snap);
    const checks = [checkNomes(ctx, snap, arquivos), checkCasa(ctx, snap, arquivos), checkGitleaks(ctx, snap),
      checkLista(snap, arquivos, faltam), checkHistorico(ctx, pub, anteriores, tag), checkRoot(ctx), checkLayout(snap, arquivos)];
    ctx.mostrar(`portão (${arquivos.length} arquivos no snapshot):\n${checks.map((c) => `  ${c.ok ? "ok      " : "REPROVA "} ${c.id}${c.msg ? `: ${c.msg}` : ""}`).join("\n")}`);
    const rep = checks.filter((c) => !c.ok);
    if (rep.length) throw new Recusa(1, "portao", `o portão reprovou ${rep.length} de ${checks.length} checks (${rep.map((c) => c.id).join(", ")}): nada foi escrito em ${pub}`);
    // o que estava no clone vai para o _lixo (está também no histórico dele); o snapshot entra no lugar
    const velhos = readdirSync(pub).filter((x) => x !== ".git");
    if (velhos.length) {
      const dest = join(lixo, `publico-${ctx.agora()}`);
      mkdirSync(dest, { recursive: true });
      for (const x of velhos) renameSync(join(pub, x), join(dest, x));
    }
    cpSync(snap, pub, { recursive: true, dereference: false });
    const g = (args) => ctx.git(args, { cwd: pub });
    const passos = [["add", "-A"], ["commit", "-q", "-m", `release: zeno ${tag}\n\nSnapshot do portão de publicação (origem ${commit.slice(0, 12)}).`], ["tag", tag]];
    for (const a of passos) {
      const r = g(a);
      if (r.status !== 0) throw new Recusa(1, "portao", `git ${a[0]} no clone falhou: ${String(r.stderr || r.stdout).trim()}; confira o clone com git status`);
    }
    const pc = g(["rev-parse", "HEAD"]).stdout.trim(), arvore = g(["rev-parse", "HEAD^{tree}"]).stdout.trim();
    let eventos;
    try {
      S.trava = travar(S.raiz, ctx.agora);
      lerLedger(S); S.reprojetar();
      ev(S, "publicacao.preparada", null, { commit: pc, arvore, tag, origem: commit, clone: pub, arquivos: arquivos.length, prova,
        checks: Object.fromEntries(checks.map((c) => [c.id, "ok"])) }, { assinar: true });
      eventos = gravar(S);
    } catch (e) {
      ctx.mostrar(`o commit ${pc.slice(0, 12)} e a tag ${tag} estão no clone, mas o evento assinado NÃO foi gravado: o próximo portão vai reprovar o histórico. Não faça o push.`);
      throw e;
    } finally { if (S.trava) { destravar(S.trava); S.trava = null; } }
    return { codigo: 0, msg: `publicação preparada em ${pub}: commit ${pc.slice(0, 12)}, tag ${tag}. Nada foi enviado. O push é seu, no seu terminal:\n  cd ${aspas(pub)} && git push origin HEAD ${tag}`,
      dados: { commit: pc, arvore, tag, origem: commit, clone: pub }, eventos };
  } finally { rmSync(snap, { recursive: true, force: true }); } // só a pasta temporária criada acima
}
