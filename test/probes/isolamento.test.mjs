// probe isolamento (D3): import e symlink para outra raiz são pegos no validar --codigo.
import { test } from "node:test"; import assert from "node:assert/strict"; import { mkdtempSync, writeFileSync, symlinkSync } from "node:fs";
import { raizTmp as tmpdir } from "../ajuda.mjs"; import { join } from "node:path"; import { run } from "../../core/run.mjs";
test("probe isolamento", async () => {
  const d = mkdtempSync(join(tmpdir(), "zeno-iso-"));
  const raiz = ["conhe", "cimento"].join(""); // montado em partes: este arquivo não pode casar com a própria regra
  writeFileSync(join(d, "a.mjs"), `import x from "../${raiz}/schema/y.mjs";\n`);
  symlinkSync("/x/avaliacao/bench", join(d, "atalho"));
  const r = await run(["validar", "--codigo", d, "--json"], { cwd: d });
  const regras = JSON.parse(r.stdout).erros.map((e) => e.regra);
  assert.equal(regras.filter((x) => x === "isolamento").length, 2);
});
