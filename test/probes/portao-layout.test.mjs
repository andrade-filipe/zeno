// probe portao-layout (T119): o check 7 do portão reprova um caminho do monorepo que a tabela LAYOUT não troca (uma
// frase nova fora dela), e o clone não muda. O caminho que a tabela cobre passa, já trocado.
import { test } from "node:test"; import assert from "node:assert/strict";
import { montarPortao, reprovouSo } from "../portao-ajuda.mjs";

test("probe portao-layout", async () => {
  const ok = await montarPortao({ extra: { "README.md": "# Zeno\n\nRode `$CE/zeno/bin/zeno versao`.\n" } });
  assert.equal((await ok.publicar()).codigo, 0, "o caminho coberto pela tabela passa");
  assert.match(ok.ler("README.md"), /Rode `\$CE\/bin\/zeno versao`/);
  const P = await montarPortao({ extra: { "README.md": "# Zeno\n\nO censo: `node $CE/avaliacao/censo.mjs`.\n" } });
  reprovouSo(assert, await P.publicar(), "layout", P.digital(), P);
});
