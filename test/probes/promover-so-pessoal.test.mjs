// probe promover-so-pessoal (T106): depois de trocar a cópia, mesmo com a confirmação da pessoa, o promover só roda o
// sync nos alvos que o registro diz que a frota opera (pessoal, checkout principal). Um alvo de cliente e um de empresa
// com deriva ficam byte a byte iguais (arquivos, .git/config e HEAD); o pessoal com deriva fica sem ela.
import { test } from "node:test"; import assert from "node:assert/strict";
import { montarFrota, digital, check } from "../frota-ajuda.mjs";

test("probe promover-so-pessoal", async () => {
  const F = await montarFrota();
  const cli = digital(F.cliente), emp = digital(F.empresa);
  assert.equal((await check(F.A, F.cliente)).codigo, 1, "o cliente tem deriva antes");
  const r = await F.promover("s");
  assert.equal(r.codigo, 0, r.stdout + r.stderr);
  assert.equal((await check(F.A, F.forma)).codigo, 0, "o pessoal com deriva foi sincronizado");
  assert.equal(digital(F.cliente), cli, "o promover não escreve em alvo de cliente");
  assert.equal(digital(F.empresa), emp, "o promover não escreve em alvo de empresa");
});
