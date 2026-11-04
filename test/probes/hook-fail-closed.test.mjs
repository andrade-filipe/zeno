// probe hook-fail-closed (C3): os hooks que guardam negam quando o zeno falha (|| exit 2).
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo } from "../ajuda.mjs";
test("probe hook-fail-closed", async () => {
  const A = await alvo();
  assert.equal((await A.z(["sync"], "agente", { which: () => true, rodar: () => ({ status: 0, ms: 0, stdout: "" }) })).codigo, 0);
  const h = JSON.parse(A.ler(".claude/settings.json")).hooks;
  assert.match(h.PreToolUse[0].hooks[0].command, /\|\| exit 2$/);
  assert.match(h.PostToolUse[0].hooks[0].command, /\|\| exit 2$/);
});
