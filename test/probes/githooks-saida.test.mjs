// probe githooks-saida (T97): num clone livre o sync liga o gate de commit (core.hooksPath em .agents/githooks); se o
// hooksPath sai dali depois, o sync --check acusa, e o sync liga de novo o que ficou sem hooksPath.
import { test } from "node:test"; import assert from "node:assert/strict";
import { statSync, chmodSync } from "node:fs";
import { criarAlvo, gitReal } from "../ajuda.mjs";
const comPath = { which: () => true, rodar: () => ({ status: 0, ms: 0, stdout: "" }) };
const cfg = (A, k) => gitReal(["config", "--local", "--get", k], { cwd: A.dir }).stdout.trim();

test("probe githooks-saida", async () => {
  const A = await criarAlvo({ git: true }).pronto;
  assert.deepEqual((await A.z(["sync", "--check"], "agente", comPath)).j.dados.deriva.includes(".git/config core.hooksPath"), true, "clone livre ainda não ligado: acusa");
  assert.equal((await A.z(["sync"], "agente", comPath)).codigo, 0);
  assert.equal(cfg(A, "core.hooksPath"), ".agents/githooks");
  for (const n of ["pre-commit", "pre-merge-commit"]) assert.ok(statSync(A.caminho(".agents/githooks", n)).mode & 0o100, `${n} executável`);
  assert.equal((await A.z(["sync", "--check"], "agente", comPath)).codigo, 0);

  gitReal(["config", "--local", "--unset", "core.hooksPath"], { cwd: A.dir });
  let c = await A.z(["sync", "--check"], "agente", comPath);
  assert.equal(c.codigo, 1, "desligado: acusa");
  assert.deepEqual(c.j.dados.deriva, [".git/config core.hooksPath"]);

  gitReal(["config", "--local", "core.hooksPath", "/dev/null"], { cwd: A.dir });
  c = await A.z(["sync", "--check"], "agente", comPath);
  assert.equal(c.codigo, 1, "apontado para outro lugar: acusa");
  assert.ok(c.j.avisos.some((a) => /saiu de \.agents\/githooks/.test(a.msg)));
  assert.equal((await A.z(["sync"], "agente", comPath)).codigo, 0);
  assert.equal(cfg(A, "core.hooksPath"), "/dev/null", "posto por alguém: o sync não troca");

  gitReal(["config", "--local", "--unset", "core.hooksPath"], { cwd: A.dir });
  assert.equal((await A.z(["sync"], "agente", comPath)).codigo, 0);
  assert.equal(cfg(A, "core.hooksPath"), ".agents/githooks", "sem hooksPath: o sync liga de novo");
  assert.equal((await A.z(["sync", "--check"], "agente", comPath)).codigo, 0);

  // o bit de execução faz parte do gerado: hook sem ele o git ignora
  chmodSync(A.caminho(".agents/githooks/pre-commit"), 0o644);
  assert.deepEqual((await A.z(["sync", "--check"], "agente", comPath)).j.dados.deriva, [".agents/githooks/pre-commit"]);
});
