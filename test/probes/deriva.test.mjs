// probe deriva: gerado editado à mão aparece no sync --check.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo } from "../ajuda.mjs";
test("probe deriva", async () => {
  const A = await alvo();
  A.escrever("AGENTS.md", A.ler("AGENTS.md").replace("<!-- zeno:fim nucleo -->", "linha a mais\n<!-- zeno:fim nucleo -->"));
  const r = await A.z(["sync", "--check"]);
  assert.equal(r.codigo, 1);
});
