// guarda pre-tool, contaminou, fim-sessao (camada 2) e a medição do transcript.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { alvo, noP } from "./ajuda.mjs";
import { negar, medirTranscript } from "../core/verbos/guarda.mjs";
import { FP_ACEITO } from "./fp-shell.mjs";

test("negar: protegidos, ator, verbos de pessoa e histórico", () => {
  const negados = {
    "echo x > .agents/ledger.jsonl": "arquivo-protegido",
    "sed -i s/a/b/ .agents/sistema.yaml": "arquivo-protegido",
    "cp /tmp/x .agents/trabalho/a.fio.md": "arquivo-protegido",
    "node -e \"require('fs').writeFileSync('.agents/faixas.yaml','')\"": "arquivo-protegido",
    "ZENO_ATOR=ana zeno avancar x": "ator",
    "env -u CLAUDECODE zeno gate x --aprovar": "ator",
    "zeno gate x --aprovar": "pessoa",
    "node cli.mjs chave nova": "pessoa",
    "zeno caixa --aprovar": "pessoa",
    "zeno guarda fim-sessao": "pessoa",
    "git commit --no-verify -m x": "historico",
    "git commit --amend": "historico",
    "git reset --hard HEAD~1": "historico",
    "git rebase main": "historico",
  };
  for (const [c, r] of Object.entries(negados)) assert.equal(negar(c), r, c);
  for (const c of ["ls", "cat .agents/ledger.jsonl", "zeno avancar x --ate fim", "zeno caixa", "git log --oneline 2>&1", "node --test", "git commit -m 'feat: x'", "grep -c ev .agents/ledger.jsonl 2>/dev/null"]) assert.equal(negar(c), null, c);
});

const hook = (A, sub, j) => A.cru(["guarda", sub], "agente", { entrada: async () => JSON.stringify({ cwd: A.dir, session_id: "s1", ...j }) });

test("guarda pre-tool: nega com JSON do Claude Code e registra a recusa; permite o benigno", async () => {
  const A = await alvo();
  const ok = await hook(A, "pre-tool", { tool_name: "Bash", tool_input: { command: "ls" } });
  assert.equal(ok.codigo, 0);
  assert.equal(ok.stdout, "");
  const no = await hook(A, "pre-tool", { tool_name: "Bash", tool_input: { command: "echo > .agents/ledger.jsonl" } });
  assert.equal(no.codigo, 0);
  const d = JSON.parse(no.stdout).hookSpecificOutput;
  assert.equal(d.permissionDecision, "deny");
  assert.match(d.permissionDecisionReason, /Não contorne/);
  assert.ok(A.ledger().some((e) => e.ev === "recusa" && e.dados.regra === "arquivo-protegido"));
  assert.notEqual((await A.cru(["guarda", "pre-tool"], "agente", { entrada: async () => "lixo" })).codigo, 0, "entrada inválida ⇒ código ≠ 0 ⇒ || exit 2 nega");
});

test("guarda pre-tool: o falso positivo aceito diz a causa real e manda editar texto pelo Edit ou Write (T109)", async () => {
  const A = await alvo();
  const r = JSON.parse((await hook(A, "pre-tool", { tool_name: "Bash", tool_input: { command: FP_ACEITO } })).stdout).hookSpecificOutput;
  assert.equal(r.permissionDecision, "deny");
  assert.match(r.permissionDecisionReason, /regra arquivo-protegido/);
  assert.match(r.permissionDecisionReason, /API de escrita e cita um arquivo protegido, mesmo dentro de um texto/);
  assert.match(r.permissionDecisionReason, /pelo Edit ou Write/);
});

test("contaminou marca a sessão; nó novo nasce não confiável; fim-sessao mede e limpa", async () => {
  const A = await alvo();
  const antes = await noP(A, "Antes");
  await hook(A, "contaminou", { tool_name: "WebFetch" });
  assert.ok(A.ledger().some((e) => e.ev === "contaminacao.marcada" && e.dados.ferramenta === "WebFetch"));
  assert.equal((await A.z(["novo", "Depois", "--expressa", "--porque", "x"])).codigo, 1, "sessão contaminada não usa via expressa");
  const depois = (await A.z(["novo", "Depois", "--tamanho", "P"])).j.dados.id;
  assert.match(A.no(depois), /procedencia: nao-confiavel/);
  assert.match(A.no(depois), /sessao:contaminada/);
  const st = await A.z(["status"]);
  assert.ok(st.j.dados.avisos.some((a) => /contaminação/.test(a)));
  const tp = join(A.dir, "..", `transcript-${Date.now()}.jsonl`);
  const evs = A.ledger(), janela = [evs.find((e) => e.no === depois).ts, evs.find((e) => e.no === depois).ts];
  writeFileSync(tp, [
    { timestamp: janela[0], message: { id: "msg1", usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 100, cache_read_input_tokens: 999 }, content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: `zeno avancar ${antes} --pronto x` } }] } },
    { message: { id: "msg1", usage: { input_tokens: 10, output_tokens: 5 }, content: [] } },
    { message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }] } },
    { message: { id: "msg2", usage: { input_tokens: 1, output_tokens: 4 }, content: [{ type: "tool_use", id: "t2", name: "Read", input: { file_path: "/x/README.md" } }] } },
  ].map((x) => JSON.stringify(x)).join("\n"));
  const r = await hook(A, "fim-sessao", { transcript_path: tp });
  assert.equal(r.codigo, 0);
  const g = A.ledger().filter((e) => e.ev === "gasto.registrado" && e.dados.fonte === "medido");
  assert.deepEqual(g.map((e) => e.no).sort(), [antes, depois].sort(), "citado no comando ∪ mudado por agente na janela");
  assert.equal(g[0].dados.tokens, 60);
  assert.equal(g[0].dados.tokens_cache_leitura, 999);
  assert.ok(g[0].dados.bytes_sistema > 0 && g[0].dados.bytes_sistema < g[0].dados.bytes_total);
  assert.ok(A.ledger().some((e) => e.ev === "contaminacao.limpa"));
  const tarde = await noP(A, "Tarde");
  assert.match(A.no(tarde), /procedencia: confiavel/);
});

test("fim-sessao sem transcript registra gasto indisponível", async () => {
  const A = await alvo();
  await hook(A, "fim-sessao", { transcript_path: "/nao/existe.jsonl" });
  assert.equal(A.ledger().at(-1).dados.fonte, "indisponivel");
});

test("medirTranscript: sem usage, achou=false", () => {
  assert.equal(medirTranscript('{"message":{"content":[]}}').achou, false);
  assert.equal(medirTranscript("lixo\n").achou, false);
});

test("fora de um alvo o hook não faz nada", async () => {
  const A = await alvo();
  const r = await A.cru(["guarda", "pre-tool"], "agente", { entrada: async () => JSON.stringify({ cwd: "/", tool_name: "Bash", tool_input: { command: "echo > .agents/ledger.jsonl" } }) });
  assert.equal(r.codigo, 0);
  assert.equal(r.stdout, "");
});

test("fim-sessao por diferença (T66): a mesma sessão medida duas vezes não conta em dobro", async () => {
  const A = await alvo();
  const id = await noP(A);
  const tp = join(A.dir, "..", `transcript-dif-${Date.now()}.jsonl`);
  const linha = (mid, n) => JSON.stringify({ message: { id: mid, usage: { input_tokens: n, output_tokens: 0 }, content: [{ type: "tool_use", id: "t" + mid, name: "Bash", input: { command: `zeno status ${id}` } }] } });
  writeFileSync(tp, linha("a", 100));
  await hook(A, "fim-sessao", { transcript_path: tp });
  await hook(A, "fim-sessao", { transcript_path: tp });
  let g = A.ledger().filter((e) => e.ev === "gasto.registrado" && e.dados.fonte === "medido");
  assert.equal(g.length, 1, "nada novo, nada gravado");
  writeFileSync(tp, linha("a", 100) + "\n" + linha("b", 30));
  await hook(A, "fim-sessao", { transcript_path: tp });
  g = A.ledger().filter((e) => e.ev === "gasto.registrado" && e.dados.fonte === "medido");
  assert.deepEqual(g.map((e) => e.dados.tokens), [100, 30]);
  assert.equal(g[1].dados.ja_medido_tokens, 100);
});

// divergência 12: um hook chamado por outro agente (sem CLAUDECODE, sem TTY, sem marcador) grava ia:desconhecido
// e é tratado como agente. Se a regra do ator (core/sessao.mjs) mudar de propósito, este teste muda junto.
test("hooks fora do Claude Code: ator ia:desconhecido, tratado como agente", async () => {
  const A = await alvo();
  const fora = (sub, j) => A.cru(["guarda", sub], "sem-tty", { entrada: async () => JSON.stringify({ cwd: A.dir, session_id: "s9", ...j }) });
  const n = await fora("pre-tool", { tool_name: "Bash", tool_input: { command: "zeno gate x --aprovar" } });
  assert.equal(JSON.parse(n.stdout).hookSpecificOutput.permissionDecision, "deny");
  const ed = await fora("pre-tool", { tool_name: "Edit", tool_input: { file_path: A.caminho(".agents/ledger.jsonl") } });
  assert.equal(JSON.parse(ed.stdout).hookSpecificOutput.permissionDecision, "deny");
  await fora("contaminou", { tool_name: "WebFetch" });
  await fora("fim-sessao", { transcript_path: "/nao/existe" });
  const L = A.ledger();
  const rec = L.filter((e) => e.ev === "recusa");
  const con = L.find((e) => e.ev === "contaminacao.marcada");
  const gas = L.find((e) => e.ev === "gasto.registrado");
  assert.equal(rec.length, 2);
  assert.ok(con && gas);
  for (const e of [...rec, con, gas]) assert.equal(e.ator, "ia:desconhecido");
  assert.equal((await A.z(["caixa", "--aprovar"], "sem-tty")).codigo, 3);
  assert.equal((await A.z(["gate", "--teto", "usd=+1"], "sem-tty")).codigo, 3);
});
