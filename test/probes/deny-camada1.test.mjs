// probe deny-camada1 (C3): regra de negação da camada 1 que não casa com nada recusa o sync.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo } from "../ajuda.mjs";
test("probe deny-camada1", async () => {
  const A = await alvo();
  A.escrever(".agents/sistema.yaml", A.ler(".agents/sistema.yaml").replace("negar_escrita: []", 'negar_escrita: ["../sumiu"]'));
  const r = await A.z(["sync"], "agente", { which: () => true, rodar: () => ({ status: 0, ms: 0, stdout: "" }) });
  assert.equal(r.codigo, 1); assert.equal(r.j.erros[0].regra, "deny-camada1");
});
