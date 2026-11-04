// probe portao-historico (T118): o check 5 do portão reprova o clone público com commit que não veio do portão (o
// ledger guarda o commit de cada publicação) e o clone com mudança não commitada.
import { test } from "node:test"; import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { montarPortao, reprovouSo } from "../portao-ajuda.mjs";
import { gitReal } from "../ajuda.mjs";

test("probe portao-historico", async () => {
  const P = await montarPortao();
  writeFileSync(join(P.pub, "README.md"), "feito à mão no público\n");
  gitReal(["add", "-A"], { cwd: P.pub }); gitReal(["commit", "-q", "-m", "à mão"], { cwd: P.pub });
  reprovouSo(assert, await P.publicar(), "historico", P.digital(), P);
  const Q = await montarPortao();
  writeFileSync(join(Q.pub, "solto.txt"), "não commitado\n");
  reprovouSo(assert, await Q.publicar(), "historico", Q.digital(), Q);
});
