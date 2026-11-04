// probe portao-root (T118): o check 6 do portão reprova enquanto a cópia que guarda não é a do root (/opt/zeno sem a
// cópia atual, ou sem /opt/zeno). A ordem é portão, depois o root, depois a publicação.
import { test } from "node:test"; import assert from "node:assert/strict";
import { montarPortao, reprovouSo } from "../portao-ajuda.mjs";

test("probe portao-root", async () => {
  const P = await montarPortao({ root: false });
  reprovouSo(assert, await P.publicar(), "root", P.digital(), P);
  const Q = await montarPortao();
  reprovouSo(assert, await Q.publicar("pessoa", { root: null }), "root", Q.digital(), Q);
});
