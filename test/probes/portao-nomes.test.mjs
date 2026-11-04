// probe portao-nomes (T118): o check 1 do portão reprova a lista de nomes ausente ou vazia, e um nome da lista no
// snapshot (sem acento e sem caixa, no texto ou no caminho). A lista é de fixture, numa casa temporária.
import { test } from "node:test"; import assert from "node:assert/strict";
import { montarPortao, reprovouSo } from "../portao-ajuda.mjs";

test("probe portao-nomes", async () => {
  for (const opts of [{ nomes: null }, { nomes: ["# só comentário", ""] }, { extra: { "spec/x.md": "feito para a ÁCME Ltda\n" } }, { extra: { "core/cliente-x.mjs": "//\n" } }]) {
    const P = await montarPortao(opts);
    reprovouSo(assert, await P.publicar(), "nomes", P.digital(), P);
  }
});
