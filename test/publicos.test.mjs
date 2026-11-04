// os arquivos públicos do Zeno (T118): LICENSE (Apache-2.0), NOTICE, CONTRIBUTING (DCO) e SECURITY moram no zeno/ e
// entram no snapshot do portão; o CHANGELOG é gerado na hora. As plataformas ficam declaradas no SECURITY.
import { test } from "node:test"; import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ZENO_DIR } from "../core/config.mjs";
import { PUBLICOS } from "../core/portao.mjs";

const ler = (f) => readFileSync(join(ZENO_DIR, f), "utf8");

test("publicos: LICENSE Apache-2.0, NOTICE, CONTRIBUTING com DCO e SECURITY com as plataformas", () => {
  assert.deepEqual(PUBLICOS, ["LICENSE", "NOTICE", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md"]);
  assert.match(ler("LICENSE"), /Apache License\s+Version 2\.0, January 2004[\s\S]*END OF TERMS AND CONDITIONS/);
  assert.match(ler("NOTICE"), /Apache License, Version 2\.0/);
  assert.match(ler("CONTRIBUTING.md"), /Developer Certificate of Origin[\s\S]*git commit -s[\s\S]*Signed-off-by:/);
  assert.match(ler("SECURITY.md"), /\*\*Linux\*\* e \*\*WSL2\*\*: com suporte[\s\S]*\*\*macOS\*\*: sem suporte na v0\.1/);
});
