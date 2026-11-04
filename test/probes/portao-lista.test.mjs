// probe portao-lista (T118): o check 4 do portão reprova arquivo fora da lista do que entra (no topo ou aninhado em
// pasta que fica fora) e arquivo da lista que falta (LICENSE e cia., página de docs/).
import { test } from "node:test"; import assert from "node:assert/strict";
import { montarPortao, reprovouSo } from "../portao-ajuda.mjs";

test("probe portao-lista", async () => {
  for (const opts of [{ extra: { "notas.txt": "rascunho\n" } }, { extra: { "test/fixtures/.agents/ledger.jsonl": "{}\n" } }, { sem: ["LICENSE"] }, { sem: ["SECURITY.md"] }]) {
    const P = await montarPortao(opts);
    reprovouSo(assert, await P.publicar(), "lista", P.digital(), P);
  }
});
