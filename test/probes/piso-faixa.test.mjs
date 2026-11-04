// probe piso-faixa (C2): agente não declara M abaixo de aprovação; nem a projeção aceita; P grande demais é reprovado.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo } from "../ajuda.mjs";
test("probe piso-faixa", async () => {
  const A = await alvo();
  const r = await A.z(["novo", "Grande disfarçado", "--tamanho", "M", "--faixa", "autonoma"]);
  assert.equal(r.codigo, 1); assert.equal(r.j.erros[0].regra, "piso-faixa");
});
