// probe sem-sessao (T82): com sessao_obrigatoria no sistema.yaml, o hook nega TODA ferramenta se a fronteira do zeno
// sessao não está de pé (sem marcador, interop à vista, a pasta da chave à vista, env fora da allowlist); dentro dela, passa.
import { test } from "node:test"; import assert from "node:assert/strict";
import { alvo } from "../ajuda.mjs";

test("probe sem-sessao", async () => {
  const A = await alvo();
  const com = { which: () => true, rodar: () => ({ status: 0, ms: 0, stdout: "" }) };
  const hook = (tool, over = {}) => A.cru(["guarda", "pre-tool"], "agente", { entrada: async () => JSON.stringify({ cwd: A.dir, session_id: "s", tool_name: tool, tool_input: { file_path: A.caminho("x.md") } }), ...over });
  const negou = (r) => { try { return JSON.parse(r.stdout).hookSpecificOutput.permissionDecision === "deny"; } catch { return false; } };
  // sem a chave: nada muda
  assert.equal(negou(await hook("Read")), false);
  A.escrever(".agents/sistema.yaml", A.ler(".agents/sistema.yaml") + "sessao_obrigatoria: true\n");
  assert.equal((await A.z(["sync"], "agente", com)).codigo, 0);
  const pre = JSON.parse(A.ler(".claude/settings.json")).hooks.PreToolUse;
  assert.deepEqual(pre.map((h) => h.matcher), ["*"], "um hook para toda ferramenta");
  // fora da sessão: toda ferramenta é negada, com o motivo
  const r = await hook("Read");
  assert.ok(negou(r), r.stdout); assert.match(JSON.parse(r.stdout).hookSpecificOutput.permissionDecisionReason, /sem o marcador/);
  assert.equal(A.ledger().at(-1).dados.regra, "sem-sessao");
  // dentro, com a fronteira de pé: passa; com o interop ou a chave à vista: nega
  const dentro = { marcador: "ia:claude", env: {}, existe: () => false };
  assert.equal(negou(await hook("Read", dentro)), false);
  assert.ok(negou(await hook("Read", { ...dentro, existe: (p) => p === "/run/WSL" })));
  assert.ok(negou(await hook("Read", { ...dentro, existe: (p) => p.endsWith("/.config/zeno") })));
  assert.ok(negou(await hook("Read", { ...dentro, env: { WSL_INTEROP: "/run/WSL/1" } })));
});
