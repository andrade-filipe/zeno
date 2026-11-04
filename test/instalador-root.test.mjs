// O instalador root (T95), provado numa /opt/zeno falsa (test/raiz-root.mjs), sem sudo: instala só com o sha256 e a
// assinatura certos, troca o atual de forma atômica, volta com --voltar e não apaga nada. As 3 recusas que guardam
// (sha256, assinatura, pessoa.pub) têm sonda própria no censo (test/probes/instalar-*.test.mjs).
import { test } from "node:test"; import assert from "node:assert/strict";
import { existsSync, readlinkSync, readFileSync, statSync, chmodSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { raizFalsa } from "./raiz-root.mjs";

test("instalador root: instala com sha256 e assinatura certos; troca o atual; volta; nada é apagado", () => {
  const R = raizFalsa();
  try {
    const a = R.pacote("aaaaaaaaaaaa", { arquivos: { "cli.mjs": "// a\n", "bin/zeno": "#!/bin/sh\n" } });
    const r = R.rodar("aaaaaaaaaaaa", a.sha, a.tar, a.sig);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readlinkSync(join(R.raiz, "atual")), join(R.raiz, "aaaaaaaaaaaa"));
    assert.equal(readFileSync(join(R.raiz, "atual", "cli.mjs"), "utf8"), "// a\n");
    for (const f of ["cli.mjs", "bin"]) assert.equal(statSync(join(R.raiz, "aaaaaaaaaaaa", f)).mode & 0o022, 0, `${f} sem escrita de grupo e de outros`);
    const b = R.pacote("bbbbbbbbbbbb", { arquivos: { "cli.mjs": "// b\n" } });
    assert.equal(R.rodar("bbbbbbbbbbbb", b.sha, b.tar, b.sig).status, 0);
    assert.equal(readFileSync(join(R.raiz, "atual", "cli.mjs"), "utf8"), "// b\n");
    assert.ok(existsSync(join(R.raiz, "aaaaaaaaaaaa", "cli.mjs")), "a cópia anterior fica");
    const v = R.rodar("--voltar", "aaaaaaaaaaaa");
    assert.equal(v.status, 0, v.stderr);
    assert.equal(readFileSync(join(R.raiz, "atual", "cli.mjs"), "utf8"), "// a\n");
    assert.equal(readdirSync(join(R.raiz, "_recebidos")).length, 2, "o que chegou fica em _recebidos");
    // a mesma cópia de novo: confere tudo e só troca o atual
    assert.equal(R.rodar("bbbbbbbbbbbb", b.sha, b.tar, b.sig).status, 0);
    assert.equal(readFileSync(join(R.raiz, "atual", "cli.mjs"), "utf8"), "// b\n");
  } finally { R.limpar(); }
});

test("instalador root: recusa nomes estranhos, uso errado, --voltar sem cópia e raiz gravável por outros", () => {
  const R = raizFalsa();
  try {
    const a = R.pacote("aaaaaaaaaaaa");
    for (const c of ["aaaa", "AAAAAAAAAAAA", "aaaaaaaaaaa'", "../aaaaaaaaa", "aaaaaa aaaaa", "aaaaaaaaaaaa\nx"]) {
      const r = R.rodar(c, a.sha, a.tar, a.sig);
      assert.equal(r.status, 1, `commit ${JSON.stringify(c)}`);
      assert.match(r.stderr, /commit inválido/, `o nome é recusado antes de tudo: ${JSON.stringify(c)}`);
    }
    assert.equal(R.rodar("aaaaaaaaaaaa", "x".repeat(64), a.tar, a.sig).status, 1, "sha256 que não é hex");
    assert.equal(R.rodar("aaaaaaaaaaaa", a.sha, a.tar).status, 1, "faltou a assinatura");
    assert.equal(R.rodar("--voltar", "cccccccccccc").status, 1, "não há cópia para voltar");
    assert.ok(!existsSync(join(R.raiz, "atual")));
    chmodSync(R.raiz, 0o775);
    assert.match(R.rodar("aaaaaaaaaaaa", a.sha, a.tar, a.sig).stderr, /gravável/);
    chmodSync(R.raiz, 0o755);
    assert.equal(R.rodar("aaaaaaaaaaaa", a.sha, a.tar, a.sig).status, 0, "com a raiz certa, instala");
  } finally { R.limpar(); }
});
