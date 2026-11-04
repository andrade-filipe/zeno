// probe contaminacao (C5): depois de WebFetch na sessão, nó novo nasce não confiável.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo } from "../ajuda.mjs";
test("probe contaminacao", async () => {
  const A = await alvo();
  await A.cru(["guarda", "contaminou"], "agente", { entrada: async () => JSON.stringify({ cwd: A.dir, session_id: "s", tool_name: "WebFetch" }) });
  const r = await A.z(["novo", "Depois da web", "--tamanho", "P"]);
  assert.equal(r.j.dados.faixa_efetiva, "aprovacao");
});
