// probe instalar-assinatura (T95): o instalador root recusa uma cópia assinada por outra chave e uma assinatura de
// outro commit, mesmo com o sha256 certo. Sem a conferência, qualquer processo que chegue ao sudo instala o que quiser.
import { test } from "node:test"; import assert from "node:assert/strict"; import { existsSync } from "node:fs";
import { join } from "node:path";
import { raizFalsa, outraChave } from "../raiz-root.mjs";
test("probe instalar-assinatura", () => {
  const R = raizFalsa();
  try {
    const outra = R.pacote("aaaaaaaaaaaa", { chave: outraChave() });
    const r1 = R.rodar("aaaaaaaaaaaa", outra.sha, outra.tar, outra.sig);
    assert.equal(r1.status, 1);
    assert.match(r1.stderr, /assinatura inválida/);
    const deOutroCommit = R.pacote("bbbbbbbbbbbb", { assinado: "cccccccccccc" });
    const r2 = R.rodar("bbbbbbbbbbbb", deOutroCommit.sha, deOutroCommit.tar, deOutroCommit.sig);
    assert.equal(r2.status, 1);
    assert.match(r2.stderr, /assinatura inválida/);
    assert.ok(!existsSync(join(R.raiz, "atual")), "nada instalado");
  } finally { R.limpar(); }
});
