// probe lint-msg: pedido sem os campos obrigatórios não entra no fio.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo, noP } from "../ajuda.mjs";
test("probe lint-msg", async () => {
  const A = await alvo();
  const id = await noP(A);
  const r = await A.z(["msg", id, "pedido", "--para", "ia:claude", "--objetivo", "trocar o link"]);
  assert.equal(r.codigo, 1); assert.equal(A.fio(id), "");
});
