// O gasto entra sozinho no ledger: os verbos que mudam estado de nó medem a sessão de CLAUDE_CODE_SESSION_ID por
// diferença, com os subagentes; o SessionEnd segue e grava só o que falta (core/gasto.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { alvo, noM, ESPEC_M, raizTmp } from "./ajuda.mjs";
import { negar } from "../core/verbos/guarda.mjs";
import { sha256 } from "../core/util.mjs";

const ID = "0f1e2d3c-4b5a-6978-8a9b-acbdcedf0011";
const ts = (min) => new Date(Date.UTC(2026, 0, 1, 0, min)).toISOString();
const linha = (mid, tokens, min, cmd = "ls", extra = {}) => JSON.stringify({ type: "assistant", timestamp: ts(min), ...extra,
  message: { id: mid, role: "assistant", usage: { input_tokens: tokens, output_tokens: 0 }, content: [{ type: "tool_use", id: "t" + mid, name: "Bash", input: { command: cmd } }] } });

// Uma pasta de config do Claude Code com o transcript da sessão e, opcionalmente, subagentes.
function config({ principal = [], subagentes = [] } = {}) {
  const base = mkdtempSync(join(raizTmp(), "zeno-claude-"));
  const proj = join(base, "projects", "-home-alguem-repo");
  mkdirSync(proj, { recursive: true });
  const tp = join(proj, `${ID}.jsonl`);
  writeFileSync(tp, principal.join("\n") + "\n");
  if (subagentes.length) {
    mkdirSync(join(proj, ID, "subagents"), { recursive: true });
    subagentes.forEach((ls, i) => writeFileSync(join(proj, ID, "subagents", `agent-a${i}.jsonl`), ls.join("\n") + "\n"));
  }
  return { base, tp };
}
const comSessao = (cfg, extra = {}) => ({ env: { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: ID, CLAUDE_CONFIG_DIR: cfg.base, ...extra } });
const medidos = (A) => A.ledger().filter((e) => e.ev === "gasto.registrado" && e.dados.fonte === "medido");
const hookFim = (A, tp) => A.cru(["guarda", "fim-sessao"], "agente", { entrada: async () => JSON.stringify({ cwd: A.dir, session_id: ID, transcript_path: tp }) });

test("avancar com a variável grava o medido com o principal e 2 subagentes; de novo, nada; o SessionEnd grava só a diferença", async () => {
  const A = await alvo();
  const id = await noM(A);
  const cfg = config({
    principal: [linha("p1", 100, 1, `zeno avancar ${id}`)],
    subagentes: [[linha("s1", 20, 2, "zeno contexto " + id, { isSidechain: true })], [linha("s2", 3, 3, "ls", { isSidechain: true })]],
  });
  await A.z(["avancar", id, ...ESPEC_M], "agente", comSessao(cfg));
  let g = medidos(A);
  assert.equal(g.length, 1);
  assert.equal(g[0].no, id);
  assert.equal(g[0].dados.tokens, 123, "principal + 2 subagentes");
  assert.equal(g[0].dados.subagentes, 2);
  assert.equal(g[0].dados.origem, "cli");
  assert.equal(g[0].dados.sessao_sha256, sha256(ID), "a mesma chave que o SessionEnd usa");
  assert.deepEqual(g[0].dados.sessao_total, { tokens: 123, cache: 0, bs: g[0].dados.sessao_total.bs, bt: g[0].dados.sessao_total.bt });

  await A.z(["status", id], "agente", comSessao(cfg));
  await A.z(["avancar", id], "agente", comSessao(cfg));
  assert.equal(medidos(A).length, 1, "sem transcript novo, nada gravado");

  appendFileSync(cfg.tp, linha("p2", 7, 4, "ls") + "\n");
  assert.equal((await hookFim(A, cfg.tp)).codigo, 0);
  g = medidos(A);
  assert.equal(g.length, 2);
  assert.equal(g[1].dados.tokens, 7, "o SessionEnd grava só a diferença, sem dobra");
  assert.equal(g[1].dados.origem, "fim-sessao");
  assert.equal(g[1].dados.ja_medido_tokens, 123);
  assert.equal(g.reduce((s, e) => s + e.dados.tokens, 0), 130);
});

test("a medição pela CLI nunca grava contaminacao.limpa (só o fim da sessão limpa)", async () => {
  const A = await alvo();
  const id = await noM(A);
  await A.cru(["guarda", "contaminou"], "agente", { entrada: async () => JSON.stringify({ cwd: A.dir, session_id: ID, tool_name: "WebFetch" }) });
  const cfg = config({ principal: [linha("p1", 50, 1, `zeno avancar ${id}`)] });
  await A.z(["avancar", id, ...ESPEC_M], "agente", comSessao(cfg));
  assert.equal(medidos(A).length, 1);
  assert.ok(!A.ledger().some((e) => e.ev === "contaminacao.limpa"));
  await hookFim(A, cfg.tp);
  assert.ok(A.ledger().some((e) => e.ev === "contaminacao.limpa"));
});

test("sem a variável, com id fora do formato ou sem o arquivo: o mesmo código e nenhum gasto", async () => {
  const cfg = config({ principal: [linha("p1", 50, 1)] });
  const casos = [{ CLAUDE_CONFIG_DIR: cfg.base }, { CLAUDE_CODE_SESSION_ID: "../../x", CLAUDE_CONFIG_DIR: cfg.base }, { CLAUDE_CODE_SESSION_ID: "1111aaaa-0000-0000-0000-000000000000", CLAUDE_CONFIG_DIR: cfg.base }];
  for (const env of casos) {
    const A = await alvo(), B = await alvo();
    const a = await noM(A), b = await noM(B);
    const sem = await A.z(["avancar", a, ...ESPEC_M]);
    const com = await B.z(["avancar", b, ...ESPEC_M], "agente", { env: { CLAUDECODE: "1", ...env } });
    assert.equal(com.codigo, sem.codigo, JSON.stringify(env));
    assert.equal(medidos(B).length, 0, JSON.stringify(env));
    assert.ok(!B.ledger().some((e) => e.ev === "gasto.registrado"));
  }
});

test("transcript sem chamada de modelo não grava indisponivel, nem pela CLI nem pelo SessionEnd", async () => {
  const A = await alvo();
  const id = await noM(A);
  const cfg = config({ principal: [JSON.stringify({ type: "user", timestamp: ts(1), message: { role: "user", content: "/mcp" } })] });
  await A.z(["avancar", id, ...ESPEC_M], "agente", comSessao(cfg));
  await hookFim(A, cfg.tp);
  assert.ok(!A.ledger().some((e) => e.ev === "gasto.registrado"));
});

test("SessionEnd: sem transcript e com o formato quebrado gravam indisponivel com o motivo", async () => {
  const A = await alvo();
  await hookFim(A, "/nao/existe.jsonl");
  const cfg = config({ principal: [JSON.stringify({ type: "assistant", timestamp: ts(1), message: { role: "assistant", content: [] } })] });
  await hookFim(A, cfg.tp);
  const ind = A.ledger().filter((e) => e.ev === "gasto.registrado" && e.dados.fonte === "indisponivel").map((e) => e.dados.motivo);
  assert.deepEqual(ind, ["sem-transcript", "formato"]);
});

test("uma sessão com nós em 2 alvos grava em cada ledger só a parte dos nós dele", async () => {
  const A = await alvo(), B = await alvo();
  const a = await noM(A, "Tarefa em A"), b = await noM(B, "Tarefa em B");
  const cfg = config({ principal: [linha("p1", 100, 1, `zeno avancar ${a}`), linha("p2", 100, 2, `zeno avancar ${b}`)] });
  await A.z(["avancar", a, ...ESPEC_M], "agente", comSessao(cfg));
  await B.z(["avancar", b, ...ESPEC_M], "agente", comSessao(cfg));
  const ga = medidos(A), gb = medidos(B);
  assert.deepEqual(ga.map((e) => [e.no, e.dados.tokens, e.dados.nos_fora]), [[a, 100, 1]]);
  assert.deepEqual(gb.map((e) => [e.no, e.dados.tokens, e.dados.nos_fora]), [[b, 100, 1]]);
  assert.ok(!ga.some((e) => e.no === b) && !gb.some((e) => e.no === a));
});

test("novo e registrar também medem; o gasto de depois de um --retro não sai marcado como retro", async () => {
  const A = await alvo();
  const cfg = config({ principal: [linha("p1", 40, 1)] });
  const r = await A.z(["novo", "Com gasto", "--tamanho", "M", "--porque", "x", "--para", "y", "--fora", "z"], "agente", comSessao(cfg));
  assert.equal(r.codigo, 0);
  assert.deepEqual(medidos(A).map((e) => [e.no, e.dados.tokens]), [[r.j.dados.id, 40]]);
  appendFileSync(cfg.tp, linha("p2", 5, 2) + "\n");
  const rr = await A.z(["registrar", "Feito antes", "--retro", "--tamanho", "P", "--inicio", ts(0), "--fim", ts(1), "--porque", "x", "--pronto", "x", "--feito", "x", "--evidencia", "x", "--ref", "x", "--desfazer", "x"], "agente", comSessao(cfg));
  const g = medidos(A).at(-1);
  assert.equal(g.dados.tokens, 5, JSON.stringify(rr.j?.erros));
  assert.ok(!g.retro, "a medição é de agora");
});

test("a leitura do transcript vem antes do verbo, que é quem pega a trava do ledger", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "core", "run.mjs"), "utf8");
  const ler = src.indexOf("lerSessaoDaCli(c)"), verbo = src.indexOf("r = await f(c, pos, o, reg)");
  assert.ok(ler > 0 && verbo > 0 && ler < verbo);
});

test("a guarda nega mexer na variável da sessão (regra ator)", () => {
  for (const c of [`CLAUDE_CODE_SESSION_ID=${ID} zeno avancar x`, "export CLAUDE_CODE_SESSION_ID=x", "env -u CLAUDE_CODE_SESSION_ID zeno novo y", "unset CLAUDE_CODE_SESSION_ID"])
    assert.equal(negar(c), "ator", c);
  assert.equal(negar("echo $CLAUDE_CODE_SESSION_ID"), null);
});
