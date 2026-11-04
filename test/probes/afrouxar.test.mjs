// probe afrouxar (C2): afrouxar pelo efeito pede pessoa e assinatura, na CLI e na projeção.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo, noP } from "../ajuda.mjs";
test("probe afrouxar", async () => {
  const A = await alvo();
  const id = await noP(A, "Com check", ["--check", "passa"]);
  const r = await A.z(["ajustar", id, "checks=", "faixa=autonoma"]);
  assert.equal(r.codigo, 3, "agente tirando check é recusado");
  assert.equal((await A.z(["status", id])).j.dados.checks.length, 1);
});
