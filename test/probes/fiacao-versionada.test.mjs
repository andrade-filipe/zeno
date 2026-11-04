// probe fiacao-versionada (T113): num alvo pessoal adotado sem .claude/settings.json próprio, o sync gera a fiação do Zeno
// no .claude/settings.json versionado (travas, Stop e SessionStart), e não no settings.local.json por máquina.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { criarAlvo } from "../ajuda.mjs";

test("probe fiacao-versionada: pessoal adotado sem settings.json ⇒ .claude/settings.json gerado, sem o local", async () => {
  const A = await criarAlvo({ antes: (d) => writeFileSync(join(d, "AGENTS.md"), "# Repo\n") }).pronto;
  const r = await A.z(["sync"], "agente", { which: () => true, rodar: () => ({ status: 0, ms: 0, stdout: "" }) });
  assert.equal(r.codigo, 0, r.stdout);
  assert.ok(A.existe(".claude/settings.json"), "a fiação não foi versionada");
  assert.equal(A.existe(".claude/settings.local.json"), false);
  const s = JSON.parse(A.ler(".claude/settings.json"));
  assert.equal(s.hooks.Stop[0].hooks[0].command, "zeno guarda parar || true");
  assert.equal(s.hooks.SessionStart[0].hooks[0].command, "zeno contexto --bloco");
  assert.ok(s.permissions.deny.includes("Edit(/.agents/ledger.jsonl)"));
});
