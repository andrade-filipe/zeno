// probe instalar-sha256 (T95): o instalador root recusa um tar trocado depois de assinado (o sha256 assinado é o do
// tar provado; o que chegou é outro). Sem a conferência, a assinatura passa (é do sha256 recebido) e o tar trocado entra.
import { test } from "node:test"; import assert from "node:assert/strict"; import { existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { raizFalsa } from "../raiz-root.mjs";
test("probe instalar-sha256", () => {
  const R = raizFalsa();
  try {
    const bom = R.pacote("aaaaaaaaaaaa", { arquivos: { "cli.mjs": "// provado\n" } });
    const mau = R.pacote("bbbbbbbbbbbb", { arquivos: { "cli.mjs": "// trocado\n" } });
    copyFileSync(mau.tar, bom.tar); // a troca no meio do caminho: mesmo nome, outro conteúdo
    const r = R.rodar("aaaaaaaaaaaa", bom.sha, bom.tar, bom.sig);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /sha256 diferente/);
    assert.ok(!existsSync(join(R.raiz, "atual")) && !existsSync(join(R.raiz, "aaaaaaaaaaaa")), "nada instalado");
  } finally { R.limpar(); }
});
