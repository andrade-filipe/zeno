// validar.mjs — as regras de spec/no.md (validação), append-only com --staged, --reparar e --codigo.
import { existsSync, readdirSync, readFileSync, lstatSync, readlinkSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { abrir, vista, controleDe, paiAgente } from "../sessao.mjs";
import { commitSemNo, comandoRetro } from "../habito.mjs";
import { faixaEfetiva, ancestrais } from "../projecao.mjs";
import { lerNo, idsNoDisco, caminhoFio, CONTROLE, shaArtefato, secoes } from "../no.mjs";
import { lerFio, lint } from "../mensagens.mjs";
import { subsequencia } from "../ledger.mjs";
import { P, ZENO_DIR } from "../config.mjs";
import { FASES, TIPOS, TAMANHOS, FAIXAS, ESTADOS, ehAgente, lista, num, canon, duracao, Recusa } from "../util.mjs";

const OBRIG = ["zeno", "id", "tipo", "titulo", "criado", "fase", "estado", "dono", "executor", "tamanho", "faixa", "procedencia", "janela"];
// montadas por partes para o texto da regra não casar com ela mesma
const TTY = "is" + "TTY", LE_PROCESSO = new RegExp(`process\\.(env|stdin|argv)\\b|\\b${TTY}\\b`), CTX_TTY = new RegExp(`ctx\\.${TTY}|${TTY}:`, "g");
const ATRITO = new Set(["gate.decidido", "recusa", "disjuntor.disparou", "msg.recusada"]);

export function validarAlvo(S, { staged = false } = {}) {
  const { cfg, raiz } = S, nos = S.proj.nos;
  const erros = [...cfg.errs, ...S.led.erros, ...S.proj.erros], avisos = [];
  const E = (arq, ln, regra, msg) => erros.push([arq, ln, regra, msg]);
  for (const p of cfg.pisoErros) E(".agents/faixas.yaml", 0, "faixas-piso", p);
  for (const a of Object.keys(cfg.acoes)) if (!FAIXAS.includes(cfg.acoes[a].faixa)) E(".agents/faixas.yaml", 0, "schema", `ação ${a} sem faixa válida`);
  const ids = idsNoDisco(raiz);
  for (const id of nos.keys()) if (!ids.includes(id)) E(`.agents/trabalho/${id}.md`, 0, "id", "o ledger tem o nó, o disco não");
  const porId = new Map(S.led.eventos.map((e) => [e.id, e]));
  for (const id of ids) {
    const n = lerNo(raiz, id), rel = n.rel, fm = n.fm;
    erros.push(...n.errs);
    for (const k of OBRIG) if (fm[k] === undefined || fm[k] === null || fm[k] === "") E(rel, 0, "schema", `campo obrigatório faltando: ${k}`);
    if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(id)) E(rel, 0, "id", `id fora do formato: ${id}`);
    if (fm.id !== id) E(rel, 0, "id", `id do frontmatter (${fm.id}) ≠ nome do arquivo`);
    if (fm.tipo && !TIPOS.includes(fm.tipo)) E(rel, 0, "schema", `tipo inválido: ${fm.tipo}`);
    if (fm.tamanho && !TAMANHOS.includes(fm.tamanho)) E(rel, 0, "schema", `tamanho inválido: ${fm.tamanho}`);
    if (fm.estado && !ESTADOS.includes(fm.estado)) E(rel, 0, "schema", `estado inválido: ${fm.estado}`);
    if (fm.faixa && !FAIXAS.includes(fm.faixa)) E(rel, 0, "schema", `faixa inválida: ${fm.faixa}`);
    if (fm.fase && ![...FASES, "fechado"].includes(fm.fase)) E(rel, 0, "schema", `fase inválida: ${fm.fase}`);
    if (fm.janela && duracao(fm.janela) === null) E(rel, 0, "schema", `janela inválida: ${fm.janela}`);
    const ordem = secoes(n.corpo).ordem;
    if (ordem.join() !== FASES.join()) E(rel, 0, "secoes", "as 7 seções de fase têm de existir, nessa ordem");
    const st = nos.get(id);
    if (!st) { E(rel, 0, "projecao", "nó sem no.criado no ledger"); continue; }
    for (const k of CONTROLE) {
      const a = canon(S.tr.fmParaDisco({ [k]: controleDe(st, k) ?? null })[k] ?? null), b = canon(normal(k, fm[k]));
      if (/*G:projecao*/ a !== b) E(rel, 0, "projecao", `${k} = ${b} no frontmatter, mas o ledger diz ${a} (zeno validar --reparar regrava a vista)`);
    }
    if (st.pai && !st.pai.includes(":") && !nos.has(st.pai)) E(rel, 0, "ref", `pai inexistente: ${st.pai}`);
    for (const d of st.depende_de) if (!nos.has(d)) E(rel, 0, "ref", `depende_de inexistente: ${d}`);
    for (const [t, alvos] of Object.entries(fm.arestas || {})) {
      if (!["relaciona", "substitui", "aplica"].includes(t)) E(rel, 0, "ref", `aresta fora do vocabulário: ${t}`);
      for (const x of lista(alvos)) if (t !== "aplica" && !String(x).includes(":") && !nos.has(x)) E(rel, 0, "ref", `aresta ${t} para nó inexistente: ${x}`);
    }
    for (const [, alvo] of n.corpo.matchAll(/\[\[([^\]|#]+)/g)) if (!nos.has(alvo.trim()) && !alvo.includes(":") && !alvo.includes("/")) E(rel, 0, "ref", `link para nó inexistente: [[${alvo}]]`);
    if (faixaEfetiva(st, nos, cfg) === "nunca" && ehAgente(st.executor)) E(rel, 0, "faixa-nunca", "faixa efetiva nunca com executor agente");
    for (const p of ["dono", "executor", "revisor"]) if (st[p] && !(st[p] in cfg.pessoas) && !cfg.agentes.includes(st[p]) && !ehAgente(st[p])) E(rel, 0, "papel", `${p} desconhecido: ${st[p]}`);
    for (const [f, sha] of Object.entries(st.aprovados)) {
      if (shaArtefato(n.corpo, f) === sha) continue;
      // T87: com o gate daquela fase reaberto, a seção mudada espera a decisão nova: aviso (a Execução não anda em-gate);
      // sem o gate reaberto, segue erro, e a mensagem diz como reabrir
      if (/*G:aprovado-mudou-aviso*/ st.estado === "em-gate" && st.gate_aberto?.fase === f) avisos.push([rel, 0, "aprovado-mudou", `a seção de ${f} mudou e espera a reaprovação (gate reaberto)`]);
      else E(rel, 0, "aprovado-mudou", `a seção de ${f} mudou depois de aprovada; rode zeno avancar ${st.id} para reabrir o gate (ou zeno revisar)`);
    }
    if (st.tipo === "licao") {
      const ok = lista(fm.origem).some((o) => {
        const m = String(o).match(/^ledger:(.+)$/), mm = String(o).match(/^msg:(.+)$/);
        if (m) { const e = porId.get(m[1]); return e && ATRITO.has(e.ev) && (e.ev !== "gate.decidido" || e.dados.decisao === "reprovado"); }
        if (mm) return [...nos.keys()].some((x) => lerFio(caminhoFio(raiz, x), S.tr.deId).some((g) => g.id === mm[1] && g.tipo === "escalada"));
        return false;
      });
      if (!ok) E(rel, 0, "licao-atrito", "lição só nasce de atrito observado: origem ledger:<evento de atrito> ou msg:<escalada>");
    }
    if (st.orcamento) {
      const fs = [...nos.values()].filter((x) => x.pai === id && x.orcamento);
      for (const d of ["tokens", "usd"]) { const t = num(st.orcamento[d]), s = fs.reduce((a, x) => a + (num(x.orcamento[d]) || 0), 0); if (t !== null && s > t) E(rel, 0, "orcamento", `soma dos filhos em ${d} (${s}) passa do orçamento (${t})`); }
    }
    // fio
    const msgs = lerFio(caminhoFio(raiz, id), S.tr.deId);
    for (const m of msgs) {
      for (const v of lint(m, { cfg, msgsDoFio: msgs, existeNo: (x) => nos.has(x), envio: false })) E(`.agents/trabalho/${id}.fio.md`, m.linha, "fio", `${m.id}: ${v.msg}`);
      if (m.extras.length) E(`.agents/trabalho/${id}.fio.md`, m.extras[0], "fio", `${m.id}: linha fora do formato "- **campo:** valor"`);
    }
    // avisos
    if (st.orcamento?.prazo && Date.parse(st.orcamento.prazo) < S.ctx.agora() && !["fechado", "cancelado"].includes(st.estado)) avisos.push([rel, 0, "prazo", `prazo ${st.orcamento.prazo} vencido`]);
    const ult = st.eventos.at(-1);
    if (ult && !["fechado", "cancelado"].includes(st.estado) && S.ctx.agora() - Date.parse(ult.ts) > 14 * 86400000) avisos.push([rel, 0, "parado", "nó parado há mais de 14 dias"]);
    if (st.pai && st.pai.includes(":")) avisos.push([rel, 0, "ref", `${st.pai} não verificado (outro grafo)`]);
  }
  // ciclo em pai / depende_de
  for (const id of nos.keys()) {
    const visto = new Set([id]);
    for (let n = nos.get(id); n?.pai && nos.has(n.pai); n = nos.get(n.pai)) { if (visto.has(n.pai)) { E(`.agents/trabalho/${id}.md`, 0, "ciclo", "ciclo em pai"); break; } visto.add(n.pai); }
    const dfs = (x, pilha) => { for (const d of nos.get(x)?.depende_de || []) { if (pilha.has(d)) return true; pilha.add(d); if (dfs(d, pilha)) return true; pilha.delete(d); } return false; };
    if (dfs(id, new Set([id]))) E(`.agents/trabalho/${id}.md`, 0, "ciclo", "ciclo em depende_de");
  }
  if (staged) erros.push(...appendOnly(S));
  if (staged) {
    // T113: a deixa no commit (vale para qualquer ferramenta, pelo githook que já existe). O agente reconhecido
    // (marcador, CLAUDECODE ou CLI de agente acima) para; a pessoa, e o ator que o zeno não reconhece, só leva o aviso.
    const c = commitSemNo(S);
    if (c) {
      const agente = ehAgente(S.ator) && (S.ator !== "ia:desconhecido" || !!paiAgente(S.ctx, cfg));
      const inicio = c.inicio || new Date(S.ctx.agora()).toISOString(), fim = new Date(S.ctx.agora()).toISOString();
      const msg = `commit com ${c.arquivos.length} arquivo(s) fora de .agents/ (${c.arquivos.slice(0, 3).join(", ")}${c.arquivos.length > 3 ? ", …" : ""}) sem evento novo de nó e sem nó em Execução. `
        + `Registre o trabalho (troque os <…>), ponha o ledger no commit e tente de novo: ${comandoRetro({ inicio, fim })}`;
      if (/*G:commit-sem-no*/ agente) E(c.arquivos[0], 0, "sem-no", msg);
      else avisos.push([c.arquivos[0], 0, "sem-no", msg]);
    }
  }
  return { erros, avisos };
}

const normal = (k, v) => (["acoes", "checks", "depende_de"].includes(k) ? (lista(v).length ? lista(v) : null) : k === "orcamento" ? (v ? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, a === "prazo" ? b : num(b)])) : null) : v ?? null);

// Append-only (camada 4): HEAD → índice, por subsequência (T6).
export function appendOnly(S) {
  const erros = [], g = (args) => S.ctx.git(args, { cwd: S.raiz });
  const arquivos = [".agents/ledger.jsonl"];
  const lt = g(["ls-tree", "-r", "--name-only", "HEAD", "--", ".agents/trabalho"]);
  if (lt.status === 0) for (const f of lt.stdout.split("\n").filter((x) => x.endsWith(".fio.md"))) arquivos.push(f.slice(f.indexOf(".agents/")));
  for (const f of new Set(arquivos)) {
    const head = g(["show", `HEAD:./${f}`]);
    if (head.status !== 0) continue;
    const idx = g(["show", `:./${f}`]);
    const agora = idx.status === 0 ? idx.stdout : "";
    if (/*G:append-only*/ !subsequencia(head.stdout, agora)) erros.push([f, 1, "append-only", "arquivo editado, truncado ou removido (só acrescentar é permitido)"]);
  }
  return erros;
}

// --codigo: isolamento (D3), sem dependência (D28), sem flag de teste (T16).
export function checarCodigo(dir) {
  const erros = [], E = (f, regra, msg) => erros.push([relative(dir, f) || f, 0, regra, msg]);
  const pular = new Set(["_lixo", "node_modules", ".git", ".agents", "spec"]);
  const walk = (d, fn) => { for (const x of readdirSync(d)) { if (pular.has(x)) continue; const p = join(d, x); const s = lstatSync(p); if (s.isSymbolicLink()) fn(p, s); else if (s.isDirectory()) walk(p, fn); else fn(p, s); } };
  if (/*G:sem-dependencia*/ existsSync(join(dir, "node_modules"))) E(join(dir, "node_modules"), "sem-dependencia", "node_modules/ não pode existir (D28)");
  walk(dir, (p, s) => {
    if (s.isSymbolicLink()) { const t = resolve(join(p, ".."), readlinkSync(p)); if (/*G:isolamento*/ /\/(conhecimento|avaliacao)(\/|$)/.test(t)) E(p, "isolamento", `symlink para outra raiz: ${t}`); return; }
    if (p.endsWith("package.json")) { let j = {}; try { j = JSON.parse(readFileSync(p, "utf8")); } catch {} for (const k of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) if (/*G:sem-dependencia*/ j[k] && Object.keys(j[k]).length) E(p, "sem-dependencia", `${k} não pode existir (D28)`); }
    if (!p.endsWith(".mjs") && !p.endsWith(".js")) return;
    const txt = readFileSync(p, "utf8"), rel = relative(dir, p);
    if (/*G:isolamento*/ /(from\s+|import\s*\(\s*|require\s*\(\s*)["'][^"']*(conhecimento|avaliacao)\//.test(txt)) E(p, "isolamento", "import de outra raiz do monorepo (D3)");
    const ehTeste = rel.startsWith("test/") || rel.startsWith("test\\");
    if (!ehTeste && rel !== "cli.mjs") {
      if (/*G:sem-flag-de-teste*/ LE_PROCESSO.test(txt.replace(CTX_TTY, ""))) E(p, "sem-flag-de-teste", "só o cli.mjs lê o ambiente, a entrada e o terminal; o core recebe ctx");
    }
    if (!ehTeste && /*G:sem-flag-de-teste*/ /ZENO_(TESTE?|FAKE|TTY|MOCK)/.test(txt)) E(p, "sem-flag-de-teste", "variável de modo teste no código");
  });
  return erros;
}

export async function validar(ctx, pos, o, reg) {
  if (o.codigo) {
    const dir = resolve(ctx.cwd, typeof o.codigo === "string" ? o.codigo : pos[0] || ZENO_DIR);
    const erros = checarCodigo(dir);
    return { codigo: erros.length ? 1 : 0, msg: erros.length ? "" : "código ok", erros: erros.map(([arquivo, linha, regra, msg]) => ({ arquivo, linha, regra, msg })) };
  }
  const S = reg(abrir(ctx, o, { escrever: !!o.reparar }));
  if (o.reparar) { for (const id of S.proj.nos.keys()) if (existsSync(join(P(S.raiz).trabalho, `${id}.md`))) vista(S, id); }
  const { erros, avisos } = validarAlvo(S, { staged: !!o.staged });
  const fmt = ([a, l, r, m]) => ({ arquivo: a, linha: l, regra: r, msg: m });
  return { codigo: erros.length ? 1 : 0, msg: erros.length ? "" : `ok: ${S.proj.nos.size} nós, ${S.led.eventos.length} eventos${S.led.puladas ? `, ${S.led.puladas} linha(s) de versão desconhecida puladas` : ""}`, erros: erros.map(fmt), avisos: avisos.map(fmt) };
}
