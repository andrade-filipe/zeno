// probe portao-casa (T118): o check 2 do portão reprova um caminho de casa real no snapshot: a casa desta máquina
// (também na forma com "-"), e um /home/<nome> que não é de exemplo. Os caminhos são montados na hora, nunca escritos.
import { test } from "node:test"; import assert from "node:assert/strict";
import { montarPortao, reprovouSo } from "../portao-ajuda.mjs";

test("probe portao-casa", async () => {
  const outro = ["", "home", "zeca", "repos"].join("/"), exemplo = ["", "home", "ana", "repos"].join("/");
  const ok = await montarPortao({ extra: { "test/fp.mjs": `export const X = "cd ${exemplo}";\n` } });
  assert.equal((await ok.publicar()).codigo, 0, "a casa de exemplo passa");
  for (const linha of [(A) => `cd ${A.home}/repos`, (A) => `projetos/${A.home.replace(/\//g, "-")}-repos`, () => `cd ${outro}`]) {
    const P = await montarPortao({ extra: (A) => ({ "test/fp.mjs": `export const X = "${linha(A)}";\n` }) });
    reprovouSo(assert, await P.publicar(), "casa", P.digital(), P);
  }
});
