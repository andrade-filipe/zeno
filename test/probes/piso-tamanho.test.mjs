// probe piso-tamanho (T115): o ajustar que sobe P autônomo para M sobe a faixa ao piso de M (aprovacao) no mesmo comando.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo } from "../ajuda.mjs";
test("probe piso-tamanho", async () => {
  const A = await alvo();
  const id = (await A.z(["novo", "Pequeno que cresce", "--tamanho", "P", "--porque", "teste"])).j.dados.id;
  assert.equal((await A.z(["ajustar", id, "tamanho=M"])).codigo, 0);
  assert.match(A.no(id), /^faixa: aprovacao$/m, "subir o tamanho não subiu a faixa ao piso");
  assert.ok(A.ledger().some((e) => e.no === id && e.ev === "faixa.alterada" && e.dados.motivo === "tamanho"));
});
