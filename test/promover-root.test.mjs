// promover no modo root (T95), com uma /opt/zeno falsa (test/raiz-root.mjs): o dono declarado é o uid do teste e o
// sudo é vazio. A prova (bwrap) é fingida; o tar e o instalador rodam de verdade.
import { test } from "node:test"; import assert from "node:assert/strict";
import { existsSync, readFileSync, readlinkSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createPublicKey } from "node:crypto";
import { alvo, gitFalso } from "./ajuda.mjs";
import { ZENO_DIR } from "../core/config.mjs";
import { valida } from "../core/assinatura.mjs";
import { parseYaml } from "../core/yaml.mjs";
import { raizFalsa, uid } from "./raiz-root.mjs";

const real = (cmd, { cwd }) => { const r = spawnSync("sh", ["-c", cmd], { cwd, encoding: "utf8" }); return { status: r.status ?? 1, ms: 1, stdout: (r.stdout || "") + (r.stderr || "") }; };
const rodarRoot = (antes = () => {}) => (cmd, o) => (cmd.startsWith("bwrap") ? (antes(), { status: 0, ms: 1, stdout: "" }) : real(cmd, o));
const pemDe = (pub) => createPublicKey({ key: Buffer.from(pub, "base64"), format: "der", type: "spki" }).export({ type: "spki", format: "pem" });

async function preparar() {
  const A = await alvo(), R = raizFalsa();
  writeFileSync(R.pub, pemDe(A.pub)); chmodSync(R.pub, 0o644); // a chave da pessoa, como o bloco C grava
  R.semear("000000000000");
  mkdirSync(join(A.home, ".local", "bin"), { recursive: true });
  writeFileSync(join(A.home, ".local", "bin", "zeno"), "#!/bin/sh\n# shim velho\n");
  const root = { raiz: R.raiz, uid: uid(), sudo: "" };
  return { A, R, root };
}

test("promover root: o instalador confere e instala em /opt/zeno; o shim da casa sai; o evento leva root e sha256", async () => {
  const { A, R, root } = await preparar();
  try {
    const r = await A.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso(), rodar: rodarRoot(), root });
    assert.equal(r.codigo, 0, r.stdout + r.stderr);
    assert.equal(readlinkSync(join(R.raiz, "atual")), join(R.raiz, "abcdef123456"));
    assert.ok(existsSync(join(R.raiz, "atual", "cli.mjs")) && existsSync(join(R.raiz, "atual", "bin", "zeno-instalar-root")));
    assert.ok(existsSync(join(R.raiz, "000000000000")), "a cópia anterior fica");
    assert.ok(!existsSync(join(A.home, ".local", "share", "zeno", "atual")), "o atual da casa não é a guarda no modo root");
    assert.ok(!existsSync(join(A.home, ".local", "bin", "zeno")), "o shim da casa saiu do PATH");
    assert.ok(existsSync(join(A.home, ".local", "share", "zeno", "_lixo")), "e foi para o _lixo");
    const e = A.ledger().find((x) => x.ev === "zeno.promovido");
    assert.equal(e.dados.root, true);
    assert.equal(e.dados.anterior, "000000000000");
    assert.equal(e.dados.copia, join(R.raiz, "abcdef123456"));
    assert.match(e.dados.sha256, /^[0-9a-f]{64}$/);
    assert.ok(valida(e, parseYaml(A.ler(".agents/sistema.yaml")).obj.pessoas));
  } finally { R.limpar(); }
});

test("promover root: o instalador recusa (pessoa.pub de outra chave) e nada muda", async () => {
  const { A, R, root } = await preparar();
  try {
    writeFileSync(R.pub, R.pubPem); // a pública de outra chave
    const r = await A.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso(), rodar: rodarRoot(), root });
    assert.equal(r.codigo, 1);
    assert.match(r.stdout + r.stderr, /assinatura inválida/);
    assert.equal(readlinkSync(join(R.raiz, "atual")), join(R.raiz, "000000000000"));
    assert.ok(existsSync(join(A.home, ".local", "bin", "zeno")), "o shim fica");
    assert.ok(!A.ledger().some((x) => x.ev === "zeno.promovido"));
  } finally { R.limpar(); }
});

test("promover root (T86): se o evento não é gravado, o instalador volta o atual para a cópia anterior", async () => {
  const { A, R, root } = await preparar();
  try {
    const led = join(A.dir, ".agents", "ledger.jsonl");
    const r = await A.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso(), rodar: rodarRoot(() => chmodSync(led, 0o444)), root });
    chmodSync(led, 0o644);
    assert.notEqual(r.codigo, 0);
    assert.equal(readlinkSync(join(R.raiz, "atual")), join(R.raiz, "000000000000"), "voltou");
    assert.ok(existsSync(join(R.raiz, "abcdef123456")), "a cópia nova fica, sem ser a atual");
  } finally { R.limpar(); }
});

test("promover sem /opt/zeno, ou com ela fora do dono: tudo como antes da T95", async () => {
  for (const caso of ["ausente", "outro-dono"]) {
    const A = await alvo(), R = raizFalsa();
    try {
      const root = caso === "ausente" ? { raiz: join(R.base, "nao-existe"), uid: uid(), sudo: "" } : { raiz: R.raiz, uid: uid() + 1, sudo: "" };
      const r = await A.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso(), rodar: rodarRoot(), root });
      assert.equal(r.codigo, 0, r.stdout + r.stderr);
      const base = join(A.home, ".local", "share", "zeno");
      assert.equal(readlinkSync(join(base, "atual")), join(base, "abcdef123456"), caso);
      assert.match(readFileSync(join(A.home, ".local", "bin", "zeno"), "utf8"), /\.local\/share\/zeno\/atual\/cli\.mjs/);
      assert.ok(!A.ledger().find((x) => x.ev === "zeno.promovido").dados.root);
      if (caso === "outro-dono") assert.match(r.stdout + r.stderr, /não é do root/);
      assert.ok(!existsSync(join(R.raiz, "atual")));
    } finally { R.limpar(); }
  }
});

test("os dois git hooks preferem a cópia do root quando ela existe (T95)", () => {
  for (const h of ["pre-commit", "pre-merge-commit"]) {
    const t = readFileSync(join(ZENO_DIR, ".githooks", h), "utf8");
    const casa = t.indexOf('fixado="$HOME/.local/share/zeno/atual/cli.mjs"'), opt = t.indexOf("if [ -f /opt/zeno/atual/cli.mjs ]; then fixado=/opt/zeno/atual/cli.mjs; fi");
    assert.ok(casa >= 0 && opt > casa, `${h}: /opt/zeno/atual depois da casa, e por cima dela`);
    assert.ok(t.indexOf('juiz="$fixado"') > opt, `${h}: o juiz usa o fixado já escolhido`);
  }
});
