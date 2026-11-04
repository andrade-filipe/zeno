// probe settings-portatil (T69): os gerados não dependem de onde o checkout está. Num clone e num worktree ligado do
// mesmo commit, `sync --check` sai limpo; nada no settings.json cita o caminho do checkout.
import { test } from "node:test"; import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs"; import { join } from "node:path";
import { criarAlvo, gitReal, raizTmp as tmpdir } from "../ajuda.mjs";
const comPath = { which: () => true, rodar: () => ({ status: 0, ms: 0, stdout: "" }) };
test("probe settings-portatil", async () => {
  const A = await criarAlvo({ git: true }).pronto;
  // como no monorepo: uma raiz irmã (../conhecimento) em negar_escrita
  const fora = "fora-" + A.dir.split("/").pop();
  A.escrever(".agents/sistema.yaml", A.ler(".agents/sistema.yaml").replace("negar_escrita: []", `negar_escrita: ["../${fora}"]`));
  mkdirSync(A.caminho("..", fora), { recursive: true });
  const r0 = await A.z(["sync"], "agente", comPath);
  assert.equal(r0.codigo, 0, r0.stdout);
  assert.ok(!A.ler(".claude/settings.json").includes(A.dir), "settings.json cita o caminho do checkout");
  assert.equal(gitReal(["add", "-A"], { cwd: A.dir }).status, 0);
  // o sync ligou o gate de commit (T97), que julgaria com a cópia promovida desta máquina: aqui o commit é só o preparo
  assert.equal(gitReal(["-c", "core.hooksPath=/dev/null", "commit", "-qm", "alvo"], { cwd: A.dir }).status, 0);
  const longe = mkdtempSync(join(tmpdir(), "zeno-longe-"));
  mkdirSync(join(longe, fora));
  const wt = join(longe, "wt"), cl = join(longe, "clone");
  assert.equal(gitReal(["worktree", "add", "-q", "-b", "probe-wt", wt], { cwd: A.dir }).status, 0);
  assert.equal(gitReal(["clone", "-q", A.dir, cl], { cwd: longe }).status, 0);
  // o worktree divide a config do clone de origem (o gate já ligado); o clone novo só acusa o gate por ligar (T97)
  const r = await A.z(["sync", "--check"], "agente", { cwd: wt });
  assert.equal(r.codigo, 0, `${wt}: ${r.stdout}`);
  const c = await A.z(["sync", "--check"], "agente", { cwd: cl });
  assert.deepEqual(c.j.dados.deriva, [".git/config core.hooksPath"], `${cl}: ${c.stdout}`);
});
