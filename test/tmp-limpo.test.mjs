// tmp-limpo: o processo de teste apaga, no exit, a raiz temporária em que criou tudo (o /tmp encheu com ~30 mil pastas
// zeno-* dos testes, 2026-11-03). A prova roda num processo filho: ele cria um alvo pelo ajuda.mjs e sai; o pai confere.
import { test } from "node:test"; import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const AJUDA = join(dirname(fileURLToPath(import.meta.url)), "ajuda.mjs");

test("tmp-limpo: a raiz temporária do processo some no exit, com o alvo e o home dentro", () => {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e",
    `const m = await import(${JSON.stringify("file://" + AJUDA)}); const A = await m.alvo({ git: true }); process.stdout.write(JSON.stringify({ raiz: m.raizTmp(), dir: A.dir, home: A.home }));`], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const { raiz, dir, home } = JSON.parse(r.stdout);
  assert.ok(raiz.startsWith(tmpdir()) && dir.startsWith(raiz) && home.startsWith(raiz), "tudo sob uma raiz só");
  assert.ok(!existsSync(raiz), `sobrou ${raiz}`);
});
