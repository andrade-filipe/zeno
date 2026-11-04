// probe instalar-pub (T95): o instalador root recusa quando a pessoa.pub falta ou é gravável por outro usuário (aqui:
// escrita de grupo e de outros; o dono errado só se prova com root). Sem a conferência, quem escreve a pessoa.pub
// troca a chave em que o root confia, e uma cópia assinada pela chave dele entra.
import { test } from "node:test"; import assert from "node:assert/strict"; import { existsSync, chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { raizFalsa } from "../raiz-root.mjs";
test("probe instalar-pub", () => {
  const sem = raizFalsa({ comPub: false });
  try {
    const a = sem.pacote("aaaaaaaaaaaa");
    const r = sem.rodar("aaaaaaaaaaaa", a.sha, a.tar, a.sig);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /pessoa\.pub ausente/);
  } finally { sem.limpar(); }
  const R = raizFalsa();
  try {
    // alguém com escrita na pessoa.pub põe a chave dele e assina a cópia dele
    const intruso = generateKeyPairSync("ed25519");
    chmodSync(R.pub, 0o666);
    writeFileSync(R.pub, intruso.publicKey.export({ type: "spki", format: "pem" }));
    const p = R.pacote("aaaaaaaaaaaa", { chave: intruso.privateKey });
    const r = R.rodar("aaaaaaaaaaaa", p.sha, p.tar, p.sig);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /gravável por outro usuário/);
    assert.ok(!existsSync(join(R.raiz, "atual")), "nada instalado");
  } finally { R.limpar(); }
});
