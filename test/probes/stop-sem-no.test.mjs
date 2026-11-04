// probe stop-sem-no (T113): no Stop, o transcript com edição de arquivo do alvo e sem nenhum nó tocado faz o guarda parar
// pedir o registrar --retro (decision: block) e gravar a recusa sem-no. Transcript sintético.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { alvo } from "../ajuda.mjs";

test("probe stop-sem-no: edição no alvo sem nó ⇒ block com o retro e a recusa sem-no", async () => {
  const A = await alvo();
  const tp = join(A.dir, "..", `transcript-stop-sem-no-${process.pid}.jsonl`);
  writeFileSync(tp, JSON.stringify({ type: "assistant", timestamp: "2026-11-03T10:00:00.000Z", message: { id: "m1", role: "assistant", content: [{ type: "tool_use", id: "t1", name: "Edit", input: { file_path: join(A.dir, "src.mjs") } }] } }) + "\n");
  const r = await A.cru(["guarda", "parar"], "agente", { entrada: async () => JSON.stringify({ session_id: "s1", transcript_path: tp, cwd: A.dir, hook_event_name: "Stop", stop_hook_active: false }) });
  assert.equal(r.codigo, 0);
  assert.notEqual(r.stdout, "", "a deixa não disparou");
  const j = JSON.parse(r.stdout);
  assert.equal(j.decision, "block");
  assert.match(j.reason, /zeno registrar ".*" --retro .*--inicio 2026-11-03T10:00:00\.000Z/);
  assert.ok(A.ledger().some((e) => e.ev === "recusa" && e.dados.verbo === "guarda" && e.dados.regra === "sem-no"));
});
