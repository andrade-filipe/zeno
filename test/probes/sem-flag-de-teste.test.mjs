// probe sem-flag-de-teste (T16): o core não lê o processo nem tem variável de modo teste.
import { test } from "node:test"; import assert from "node:assert/strict"; import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { raizTmp as tmpdir } from "../ajuda.mjs"; import { join } from "node:path"; import { run } from "../../core/run.mjs";
test("probe sem-flag-de-teste", async () => {
  const d = mkdtempSync(join(tmpdir(), "zeno-flag-"));
  mkdirSync(join(d, "core"));
  writeFileSync(join(d, "core", "a.mjs"), "export const t = process" + ".env.HOME;\n");
  writeFileSync(join(d, "core", "b.mjs"), 'export const k = "ZENO_' + 'TESTE";\n');
  const r = await run(["validar", "--codigo", d, "--json"], { cwd: d });
  assert.equal(JSON.parse(r.stdout).erros.filter((e) => e.regra === "sem-flag-de-teste").length, 2);
});
