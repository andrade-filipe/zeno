// probe ator-falso (C1): dentro do Claude Code, ZENO_ATOR=pessoa é recusado.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo } from "../ajuda.mjs";
test("probe ator-falso", async () => {
  const A = await alvo();
  const r = await A.z(["novo", "x", "--expressa", "--porque", "y"], "agente", { env: { CLAUDECODE: "1", ZENO_ATOR: "ana" } });
  assert.equal(r.codigo, 1); assert.equal(r.j.erros[0].regra, "ator");
});
