// probe faixa-nunca: ação de faixa nunca não fica com executor agente.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo } from "../ajuda.mjs";
test("probe faixa-nunca", async () => {
  const A = await alvo();
  const r = await A.z(["novo", "Publicar", "--tamanho", "M", "--acao", "entrega.publicar", "--porque", "x"]);
  assert.equal(r.codigo, 1); assert.equal(r.j.erros[0].regra, "faixa-nunca");
});
