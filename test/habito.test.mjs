// T113: o hábito. O bloco do módulo abre pela rotina; a deixa no Stop (guarda parar) e no commit (validar --staged)
// pedem o registrar --retro do trabalho sem nó; a fiação do pessoal adotado sem settings.json próprio vai versionada.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { alvo, criarAlvo, noP } from "./ajuda.mjs";
import { sha256 } from "../core/util.mjs";
import { trabalhoNoTranscript } from "../core/habito.mjs";

let n = 0;
const transcript = (A, linhas) => {
  const p = join(A.dir, "..", `transcript-habito-${process.pid}-${n++}.jsonl`);
  writeFileSync(p, linhas.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return p;
};
const uso = (ts, name, input) => ({ type: "assistant", timestamp: ts, message: { id: `m${n++}`, role: "assistant", content: [{ type: "tool_use", id: `t${n++}`, name, input }] } });
const parar = (A, j) => A.cru(["guarda", "parar"], "agente", { entrada: async () => (typeof j === "string" ? j : JSON.stringify({ cwd: A.dir, session_id: "s1", hook_event_name: "Stop", stop_hook_active: false, ...j })) });
const recusas = (A) => A.ledger().filter((e) => e.ev === "recusa" && e.dados.regra === "sem-no");
const T0 = "2026-11-03T10:00:00.000Z", T1 = "2026-11-03T10:05:00.000Z";

test("(a) Stop: edição no alvo sem nó pede o retro pronto, grava a recusa sem-no, e o comando pedido funciona", async () => {
  const A = await alvo();
  const tp = transcript(A, [{ type: "user", timestamp: T0, message: { role: "user", content: "faça" } }, uso(T1, "Edit", { file_path: join(A.dir, "src", "a.mjs") })]);
  const r = await parar(A, { transcript_path: tp });
  assert.equal(r.codigo, 0);
  const j = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(j).sort(), ["decision", "reason"]);
  assert.equal(j.decision, "block");
  assert.match(j.reason, /src\/a\.mjs/);
  assert.match(j.reason, new RegExp(`zeno registrar "<o que foi feito>" --retro --tamanho P .*--inicio ${T0.replace(/\./g, "\\.")} --fim \\S+`));
  const [rc] = recusas(A);
  assert.equal(rc.dados.verbo, "guarda"); assert.equal(rc.dados.porta, "stop"); assert.equal(rc.no, null);
  assert.equal(rc.dados.sessao_sha256, sha256("s1"));
  assert.ok(!A.ledger().some((e) => e.ev === "gasto.registrado" || e.ev === "contaminacao.limpa"), "o parar não mede nem limpa a contaminação");
  // o comando pedido, com os <…> trocados, registra o retro de verdade
  const cmd = j.reason.match(/(zeno registrar .*?--desfazer "<como voltar>")/)[1].replace(/"<[^>]*>"/g, '"x"');
  const args = cmd.match(/"[^"]*"|\S+/g).map((t) => t.replace(/^"|"$/g, "")).slice(1);
  const ret = await A.z(args);
  assert.equal(ret.codigo, 0, ret.stdout);
  assert.equal(ret.j.dados.fase, "fechado");
  // de novo, com o registrar no transcript: não pede mais
  const tp2 = transcript(A, [uso(T0, "Edit", { file_path: join(A.dir, "src", "a.mjs") }), uso(T1, "Bash", { command: cmd })]);
  assert.equal((await parar(A, { transcript_path: tp2 })).stdout, "");
});

test("(a) Stop: nó tocado, stop_hook_active, .agents/ ou fora do alvo, entrada ruim e sem transcript não bloqueiam", async () => {
  const A = await alvo();
  const ed = uso(T1, "Write", { file_path: "src/b.mjs" }); // relativo: parte do cwd do hook
  for (const c of ['zeno novo "x" --expressa --porque "y"', "zeno avancar abc-def --ate fim", "node ./cli.mjs registrar gasto abc --tokens 1", "cd x && zeno msg abc-def aviso --o-que y", "zeno contexto abc-def"]) {
    const r = await parar(A, { transcript_path: transcript(A, [ed, uso(T1, "Bash", { command: c })]) });
    assert.equal(r.stdout, "", c);
  }
  assert.equal((await parar(A, { transcript_path: transcript(A, [ed, uso(T1, "Bash", { command: "zeno status" })]) })).stdout === "", false, "status não toca nó");
  const antes = recusas(A).length;
  const tp = transcript(A, [ed]);
  assert.equal((await parar(A, { transcript_path: tp, stop_hook_active: true })).stdout, "", "uma vez por parada");
  for (const fp of [join(A.dir, ".agents", "trabalho", "x.md"), ".agents/trabalho/y.md", join(A.dir, "..", "outro", "c.mjs"), "/etc/hosts"])
    assert.equal((await parar(A, { transcript_path: transcript(A, [uso(T1, "Edit", { file_path: fp })]) })).stdout, "", fp);
  for (const e of ["isto não é json", "", "null", "[]"]) { const r = await parar(A, e); assert.equal(r.codigo, 0, e); assert.equal(r.stdout, "", e); }
  assert.equal((await parar(A, { transcript_path: "/nao/existe.jsonl" })).stdout, "");
  assert.equal((await parar(A, { transcript_path: tp, cwd: join(A.dir, "..") })).stdout, "", "fora de um alvo: nada a guardar");
  assert.equal(recusas(A).length, antes, "nada bloqueado, nada gravado");
  // nó mudado por agente na janela da sessão (o id em variável de shell, T55): não bloqueia
  await noP(A, "Com nó");
  assert.equal((await parar(A, { transcript_path: transcript(A, [{ timestamp: "2000-01-01T00:00:00.000Z", message: { role: "user", content: "x" } }, ed]) })).stdout, "");
});

test("(a) Stop: git commit no Bash sem nó também pede o retro; o transcript dos subagentes entra", async () => {
  const A = await alvo();
  const r = await parar(A, { transcript_path: transcript(A, [uso(T1, "Bash", { command: "git add -A && git commit -m 'feat: x'" })]) });
  assert.match(JSON.parse(r.stdout).reason, /\(git commit\)/);
  // o subagente editou; o principal só conversou
  const tp = transcript(A, [{ timestamp: T0, message: { role: "user", content: "x" } }]);
  const sub = join(tp.replace(/\.jsonl$/, ""), "subagents");
  mkdirSync(sub, { recursive: true });
  writeFileSync(join(sub, "agent-1.jsonl"), JSON.stringify(uso(T1, "MultiEdit", { file_path: join(A.dir, "d.mjs") })) + "\n");
  assert.equal(JSON.parse((await parar(A, { transcript_path: tp })).stdout).decision, "block");
  assert.deepEqual(trabalhoNoTranscript("", A.dir, A.dir), { trabalho: null, tocou: false, ini: null });
});

// o git do índice, falso: o que está no commit, o ledger do HEAD e o do índice
const gitDe = ({ arquivos = [], head = "", idx = head, merge = false }) => (args) => {
  const k = args.join(" ");
  if (args[0] === "config") return { status: 0, stdout: args[1] === "user.email" ? "ana@teste\n" : "Ana Teste\n" };
  if (k === "rev-parse -q --verify MERGE_HEAD") return { status: merge ? 0 : 1, stdout: "" };
  if (k === "diff --cached --name-only --relative") return { status: 0, stdout: arquivos.join("\n") + "\n" };
  if (k === "show HEAD:./.agents/ledger.jsonl") return { status: 0, stdout: head };
  if (k === "show :./.agents/ledger.jsonl") return { status: 0, stdout: idx };
  if (args[0] === "log") return { status: 0, stdout: "2026-11-03T09:00:00-03:00\n" };
  return { status: 1, stdout: "" };
};
const staged = (A, quem, g, over = {}) => A.z(["validar", "--staged"], quem, { git: gitDe(g), ...over });
const semNo = (r) => [...(r.j.erros || []), ...(r.j.avisos || [])].filter((e) => e.regra === "sem-no");

test("(b) commit: o agente sem nó para com o retro pronto; a pessoa e o ator sem porta só levam o aviso", async () => {
  const A = await alvo();
  const led = A.ler(".agents/ledger.jsonl"), g = { arquivos: ["src/a.mjs", "README.md"], head: led };
  const ag = await staged(A, "agente", g);
  assert.equal(ag.codigo, 1);
  assert.equal(ag.j.erros[0].regra, "sem-no");
  assert.match(ag.j.erros[0].msg, /2 arquivo\(s\) fora de \.agents\/ \(src\/a\.mjs, README\.md\)/);
  assert.match(ag.j.erros[0].msg, /zeno registrar "<o que foi feito>" --retro --tamanho P .*--inicio 2026-11-03T12:00:00\.000Z/);
  const pe = await staged(A, "pessoa", g);
  assert.equal(pe.codigo, 0, "a pessoa nunca é barrada no commit");
  assert.equal(semNo(pe).length, 1); assert.equal(pe.j.erros.length, 0);
  const desconhecido = await staged(A, "sem-tty", g);
  assert.equal(desconhecido.codigo, 0, "o ator que o zeno não reconhece não é barrado");
  const acima = await staged(A, "sem-tty", g, { ancestrais: () => [{ comm: "bash", argv: ["bash"] }, { comm: "node", argv: ["node", "/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js"] }, { comm: "claude", argv: ["claude"] }] });
  assert.equal(acima.codigo, 1, "a CLI de agente acima é agente");
  assert.equal(semNo(acima)[0].regra, "sem-no");
});

test("(b) commit: só .agents/, evento novo de nó, nó em Execução e merge passam", async () => {
  const A = await alvo();
  const led0 = A.ler(".agents/ledger.jsonl");
  assert.deepEqual(semNo(await staged(A, "agente", { arquivos: [".agents/ledger.jsonl", ".agents/trabalho/x.md"], head: led0 })), []);
  assert.equal((await staged(A, "agente", { arquivos: ["src/a.mjs"], head: led0, merge: true })).codigo, 0, "merge não conta");
  assert.equal((await staged(A, "agente", { arquivos: [], head: led0 })).codigo, 0);
  // evento novo de nó no índice (o nó já fechou: não é a Execução que salva)
  const r = await A.z(["registrar", "Feito antes", "--retro", "--tamanho", "P", "--expressa", "--porque", "x", "--inicio", T0, "--fim", T1,
    "--pronto", "x", "--feito", "x", "--evidencia", "x", "--ref", "x", "--desfazer", "x"]);
  assert.equal(r.j.dados.fase, "fechado");
  const led1 = A.ler(".agents/ledger.jsonl");
  assert.equal((await staged(A, "agente", { arquivos: ["src/a.mjs"], head: led0, idx: led1 })).codigo, 0);
  assert.equal((await staged(A, "agente", { arquivos: ["src/a.mjs"], head: led1 })).codigo, 1, "sem evento novo, o mesmo commit para");
  // nó em Execução no alvo
  const id = await noP(A, "Em curso");
  assert.equal((await A.z(["avancar", id, "--ate", "execucao", "--pronto", "x"])).codigo, 0);
  assert.match(A.no(id), /^fase: execucao$/m);
  const led2 = A.ler(".agents/ledger.jsonl");
  assert.equal((await staged(A, "agente", { arquivos: ["src/a.mjs"], head: led2 })).codigo, 0);
});

const comPath = { which: () => true, rodar: () => ({ status: 0, ms: 0, stdout: "" }) };
const lixo = (A) => { try { return readdirSync(A.caminho(".agents", "_lixo")); } catch { return []; } };

test("(c) sync: o Stop entra no settings gerado; o local gerado de um pessoal adotado vira versionado e vai para o _lixo", async () => {
  const N = await alvo();
  assert.equal((await N.z(["sync"], "agente", comPath)).codigo, 0);
  const sn = JSON.parse(N.ler(".claude/settings.json"));
  assert.deepEqual(sn.hooks.Stop, [{ hooks: [{ type: "command", command: "zeno guarda parar || true" }] }], "o Stop não tem matcher; || true: nunca impede a parada");
  // a adoção de antes (fiação no local), e a troca para a versionada
  const A = await criarAlvo({ git: true, extra: "fiacao: local\n", antes: (d) => writeFileSync(join(d, "AGENTS.md"), "# Repo\n") }).pronto;
  assert.equal((await A.z(["sync"], "agente", comPath)).codigo, 0);
  assert.ok(A.existe(".claude/settings.local.json")); assert.equal(A.existe(".claude/settings.json"), false);
  const local = A.ler(".claude/settings.local.json");
  A.escrever(".agents/sistema.yaml", A.ler(".agents/sistema.yaml").replace("fiacao: local\n", ""));
  const c = await A.z(["sync", "--check"]);
  assert.equal(c.codigo, 1);
  assert.deepEqual(c.j.dados.deriva.filter((x) => x.startsWith(".claude/")).sort(), [".claude/settings.json", ".claude/settings.local.json"]);
  assert.equal((await A.z(["sync"], "agente", comPath)).codigo, 0);
  assert.equal(A.ler(".claude/settings.json"), local, "o mesmo conteúdo do local, com o SessionStart");
  assert.equal(A.existe(".claude/settings.local.json"), false);
  assert.ok(lixo(A).some((f) => f.endsWith(".claude__settings.local.json")), "o local gerado vai para o _lixo, nunca é apagado");
  assert.equal(A.ler("AGENTS.md"), "# Repo\n");
  assert.equal((await A.z(["sync", "--check"])).codigo, 0);
});

test("(c) sync: com settings.json próprio a fiação fica no local com aviso; empresa e cliente ficam no local", async () => {
  const P = await criarAlvo({ antes: (d) => { mkdirSync(join(d, ".claude"), { recursive: true }); writeFileSync(join(d, ".claude", "settings.json"), "{}\n"); } }).pronto;
  const r = await P.z(["sync"], "agente", comPath);
  assert.equal(r.codigo, 0);
  assert.equal(P.ler(".claude/settings.json"), "{}\n", "o settings.json do repo não muda");
  assert.equal(JSON.parse(P.ler(".claude/settings.local.json")).hooks.Stop[0].hooks[0].command, "zeno guarda parar || true");
  for (const x of [r, await P.z(["sync", "--check"])]) assert.ok(x.j.avisos.some((a) => a.regra === "fiacao" && /fiação por máquina/.test(a.msg)));
  assert.equal((await P.z(["sync", "--check"])).codigo, 0, "o aviso não é deriva");
  P.escrever(".agents/sistema.yaml", P.ler(".agents/sistema.yaml") + "fiacao: local\n");
  assert.ok(!(await P.z(["sync", "--check"])).j.avisos.some((a) => a.regra === "fiacao"), "fiacao: local cala o aviso");
  for (const fronteira of ["empresa", "cliente"]) {
    const E = await criarAlvo({ fronteira, antes: (d) => writeFileSync(join(d, "AGENTS.md"), "# Repo\n") }).pronto;
    const s = await E.z(["sync"], "agente", comPath);
    assert.equal(s.codigo, 0, s.stdout);
    assert.equal(E.existe(".claude/settings.json"), false, `${fronteira}: nada versionado`);
    assert.ok(E.existe(".claude/settings.local.json"), fronteira);
    assert.ok(!s.j.avisos.some((a) => a.regra === "fiacao"), fronteira);
  }
});

test("(d) o bloco do módulo abre pela rotina, no AGENTS.md gerado e no SessionStart", async () => {
  const frag = readFileSync(new URL("../modulos/nucleo/agents-md.md", import.meta.url), "utf8").split("\n");
  assert.equal(frag[0], "## Zeno (módulo nucleo)");
  assert.match(frag[1], /^\*\*O 1º ato num alvo, antes da 1ª edição, é abrir o nó:\*\* .*`zeno novo "…" --expressa --porque "…"`/);
  assert.match(frag[1], /`zeno registrar "…" --retro …`/);
  const N = await alvo();
  assert.equal((await N.z(["sync"], "agente", comPath)).codigo, 0);
  const ag = N.ler("AGENTS.md");
  assert.ok(ag.indexOf("**O 1º ato num alvo") > ag.indexOf("## Zeno (módulo nucleo)") && ag.indexOf("**O 1º ato num alvo") < ag.indexOf("Este alvo é governado"));
  const A = await criarAlvo({ antes: (d) => writeFileSync(join(d, "AGENTS.md"), "# Repo\n") }).pronto;
  const b = JSON.parse((await A.cru(["contexto", "--bloco"])).stdout).hookSpecificOutput.additionalContext;
  assert.equal(b.split("\n")[1], frag[1]);
  assert.match(b, /o \.claude\/settings\.json deste checkout tem as travas/, "o pessoal adotado: a fiação versionada");
});
