// probe sem-dependencia (D28): node_modules e dependencies são pegos no validar --codigo.
import { test } from "node:test"; import assert from "node:assert/strict"; import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { raizTmp as tmpdir } from "../ajuda.mjs"; import { join } from "node:path"; import { run } from "../../core/run.mjs";
test("probe sem-dependencia", async () => {
  const d = mkdtempSync(join(tmpdir(), "zeno-dep-"));
  mkdirSync(join(d, "node_modules"));
  writeFileSync(join(d, "package.json"), '{"dependencies":{"x":"1"}}');
  const r = await run(["validar", "--codigo", d, "--json"], { cwd: d });
  assert.equal(JSON.parse(r.stdout).erros.filter((e) => e.regra === "sem-dependencia").length, 2);
});
