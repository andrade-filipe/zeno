// probe disjuntor: gasto acima do teto pausa o nó e bloqueia o avanço.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo, noP } from "../ajuda.mjs";
test("probe disjuntor", async () => {
  const A = await alvo();
  const id = await noP(A, "Teto", ["--orcamento", "tokens=10"]);
  assert.equal((await A.z(["registrar", "gasto", id, "--tokens", "11"])).codigo, 4);
  assert.equal((await A.z(["avancar", id, "--pronto", "p"])).codigo, 4);
});
