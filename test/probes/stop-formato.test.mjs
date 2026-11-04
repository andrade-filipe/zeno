// probe stop-formato (T113): o contrato do hook Stop do Claude Code, que não é público como o do transcript. Entrada
// (stdin): session_id, transcript_path, cwd, hook_event_name "Stop", stop_hook_active. Saída: exit 0 e, para pedir que o
// agente siga, um JSON só com decision "block" e reason; stdout vazio deixa parar. Com stop_hook_active (o agente já está
// seguindo um block), nunca bloqueia: é o que evita o loop. Roda o cli.mjs de verdade, como o hook roda.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { alvo } from "../ajuda.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "cli.mjs");

test("probe stop-formato: entrada e saída do Stop; stop_hook_active nunca bloqueia", async () => {
  const A = await alvo();
  const tp = join(A.dir, "..", `transcript-stop-formato-${process.pid}.jsonl`);
  writeFileSync(tp, JSON.stringify({ type: "assistant", timestamp: "2026-11-03T10:00:00.000Z", message: { id: "m1", role: "assistant", content: [{ type: "tool_use", id: "t1", name: "Write", input: { file_path: join(A.dir, "x.md"), content: "x" } }] } }) + "\n");
  const hook = (ativo) => spawnSync(process.execPath, [CLI, "guarda", "parar"], {
    cwd: A.dir, encoding: "utf8", env: { PATH: process.env.PATH, HOME: A.home },
    input: JSON.stringify({ session_id: "abc-123", transcript_path: tp, cwd: A.dir, permission_mode: "default", hook_event_name: "Stop", stop_hook_active: ativo }),
  });
  const seguindo = hook(true);
  assert.equal(seguindo.status, 0, seguindo.stderr);
  assert.equal(seguindo.stdout, "", "com stop_hook_active o Stop não pode bloquear de novo (loop)");
  const r = hook(false);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(j).sort(), ["decision", "reason"]);
  assert.equal(j.decision, "block");
  assert.equal(typeof j.reason, "string");
  assert.equal(spawnSync(process.execPath, [CLI, "guarda", "parar"], { cwd: A.dir, encoding: "utf8", env: { PATH: process.env.PATH, HOME: A.home }, input: "não é json" }).status, 0);
});
