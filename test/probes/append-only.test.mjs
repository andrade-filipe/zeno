// probe append-only (camada 4): truncar o ledger commitado é pego no validar --staged.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo, noP, gitReal } from "../ajuda.mjs";
test("probe append-only", async () => {
  const A = await alvo({ git: true });
  await noP(A);
  gitReal(["add", "-A"], { cwd: A.dir }); gitReal(["commit", "-qm", "x"], { cwd: A.dir });
  A.escrever(".agents/ledger.jsonl", A.ler(".agents/ledger.jsonl").split("\n").slice(1).join("\n"));
  gitReal(["add", "-A"], { cwd: A.dir });
  const r = await A.z(["validar", "--staged"]);
  assert.equal(r.codigo, 1); assert.ok(r.j.erros.some((e) => e.regra === "append-only"));
});
