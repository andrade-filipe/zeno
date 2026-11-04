// probe portao-gitleaks (T118): o check 3 do portão reprova sem o gitleaks no PATH (ferramenta externa, nunca
// embutida) e quando o gitleaks acha segredo ou falha no snapshot.
import { test } from "node:test"; import assert from "node:assert/strict";
import { montarPortao, reprovouSo } from "../portao-ajuda.mjs";

test("probe portao-gitleaks", async () => {
  for (const gitleaks of ["ausente", "acha"]) {
    const P = await montarPortao({ gitleaks });
    reprovouSo(assert, await P.publicar(), "gitleaks", P.digital(), P);
  }
});
