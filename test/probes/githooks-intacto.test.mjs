// probe githooks-intacto (T97): o sync não toca o gate de commit de um clone que já tem o seu (core.hooksPath posto ou
// hook ativo em .git/hooks). Avisa como encadear, e o sync --check não acusa.
import { test } from "node:test"; import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs"; import { join } from "node:path";
import { criarAlvo, gitReal } from "../ajuda.mjs";
const comPath = { which: () => true, rodar: () => ({ status: 0, ms: 0, stdout: "" }) };
const cfg = (A, k) => gitReal(["config", "--local", "--get", k], { cwd: A.dir }).stdout.trim();

test("probe githooks-intacto", async () => {
  // core.hooksPath já posto (husky, lefthook)
  const A = await criarAlvo({ git: true }).pronto;
  gitReal(["config", "--local", "core.hooksPath", ".husky"], { cwd: A.dir });
  const r = await A.z(["sync"], "agente", comPath);
  assert.equal(r.codigo, 0, r.stdout);
  assert.equal(cfg(A, "core.hooksPath"), ".husky", "o hooksPath do repo fica");
  assert.equal(cfg(A, "zeno.githooks"), "", "nem a marca do Zeno");
  assert.ok(r.j.avisos.some((a) => a.regra === "githooks" && /encadeie/.test(a.msg)), JSON.stringify(r.j.avisos));
  assert.equal((await A.z(["sync", "--check"], "agente", comPath)).codigo, 0);

  // hook ativo em .git/hooks, sem hooksPath
  const B = await criarAlvo({ git: true }).pronto;
  const h = join(B.dir, ".git", "hooks", "pre-commit");
  mkdirSync(join(B.dir, ".git", "hooks"), { recursive: true });
  writeFileSync(h, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  assert.equal((await B.z(["sync"], "agente", comPath)).codigo, 0);
  assert.equal(cfg(B, "core.hooksPath"), "", "o .git/hooks do repo segue valendo");
  assert.equal(readFileSync(h, "utf8"), "#!/bin/sh\nexit 0\n");
  assert.equal((await B.z(["sync", "--check"], "agente", comPath)).codigo, 0);
});
