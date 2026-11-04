// probe procedencia (C5): origem não confiável sobe a faixa efetiva para aprovação.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo } from "../ajuda.mjs";
test("probe procedencia", async () => {
  const A = await alvo();
  const r = await A.z(["novo", "Pedido da issue", "--tamanho", "P", "--origem", "issue:42"]);
  assert.equal(r.codigo, 0); assert.equal(r.j.dados.faixa_efetiva, "aprovacao");
});
