// probe projecao: vista com campo de controle editado à mão é pega no validar.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo, noP } from "../ajuda.mjs";
test("probe projecao", async () => {
  const A = await alvo();
  const id = await noP(A);
  const p = `.agents/trabalho/${id}.md`;
  A.escrever(p, A.ler(p).replace("fase: intencao", "fase: entrega"));
  const r = await A.z(["validar"]);
  assert.ok(r.j.erros.some((e) => e.regra === "projecao"));
});
