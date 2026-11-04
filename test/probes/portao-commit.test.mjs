// probe portao-commit: o snapshot do portão sai do commit (git archive), não da pasta no disco. Um arquivo ignorado
// pelo git e um não rastreado dentro de core/ ficam fora; o snapshot é exatamente o commit, menos o que fica fora, mais
// as páginas de docs/ e o CHANGELOG. Pelo --publicar, o ignorado (o que o git status não mostra) não chega ao clone.
import { test } from "node:test"; import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { montarPortao } from "../portao-ajuda.mjs";
import { raizTmp, gitReal } from "../ajuda.mjs";
import { montar, listar, FORA, DOCS } from "../../core/portao.mjs";

test("probe portao-commit", async () => {
  const P = await montarPortao({ ignorar: ["*.log"], depois: { "core/segredo.log": "token\n", "core/solto.mjs": "// solto\n" } });
  const snap = mkdtempSync(join(raizTmp(), "zeno-snap-"));
  const ctx = { ...P.ctx, agora: () => Date.now() };
  assert.deepEqual(montar(ctx, P.src, snap, { commit: P.commit }), []);
  const doCommit = gitReal(["ls-files"], { cwd: P.src }).stdout.split("\n").filter((f) => f && !FORA.has(f.split("/")[0]));
  assert.deepEqual(listar(snap).sort(), [...doCommit, ...DOCS.map((p) => `docs/${p}`), "CHANGELOG.md"].sort());
  // pelo --publicar: o não rastreado já é recusado antes (árvore suja); o ignorado passaria pelo git status
  const Q = await montarPortao({ ignorar: ["*.log"], depois: { "core/segredo.log": "token\n" } });
  const r = await Q.publicar();
  assert.equal(r.codigo, 0, r.stdout + r.stderr);
  assert.ok(existsSync(join(Q.pub, "core", "run.mjs")) && !existsSync(join(Q.pub, "core", "segredo.log")), "o ignorado não chega ao clone");
});
