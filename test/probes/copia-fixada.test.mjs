// probe copia-fixada (T68): depois do promover, o shim da pessoa roda a cópia fixada, não o repositório que o agente edita.
import { test } from "node:test"; import assert from "node:assert/strict";
import { readFileSync } from "node:fs"; import { join } from "node:path";
import { alvo, gitFalso, rodarOk } from "../ajuda.mjs"; import { ZENO_DIR } from "../../core/config.mjs";
test("probe copia-fixada", async () => {
  const A = await alvo();
  assert.equal((await A.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso(), rodar: rodarOk })).codigo, 0);
  const shim = readFileSync(join(A.home, ".local", "bin", "zeno"), "utf8");
  assert.match(shim, /\.local\/share\/zeno\/atual\/cli\.mjs/);
  assert.ok(!shim.includes(join(ZENO_DIR, "cli.mjs")));
});
