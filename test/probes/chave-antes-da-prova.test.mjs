// probe chave-antes-da-prova (T72): passphrase errada no promover sai com 1 sem ter rodado teste nem censo.
import { test } from "node:test"; import assert from "node:assert/strict";
import { alvo, gitFalso } from "../ajuda.mjs";
import { ZENO_DIR } from "../../core/config.mjs";
test("probe chave-antes-da-prova", async () => {
  const A = await alvo();
  const rodados = [];
  const rodar = (cmd) => { rodados.push(cmd); return { status: 0, ms: 1, stdout: "" }; };
  const r = await A.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso(), rodar, segredo: async () => "passphrase-errada" });
  assert.equal(r.codigo, 1);
  assert.equal(r.j.erros[0].regra, "assinatura");
  assert.deepEqual(rodados, [], "rodou teste ou censo antes de conferir a passphrase");
  assert.ok(!A.ledger().some((e) => e.ev === "zeno.promovido"));
});
