// probe transcript-formato: o formato do transcript do Claude Code é lido (message.id + usage, dedup por id).
import { test } from "node:test"; import assert from "node:assert/strict"; import { medirTranscript } from "../../core/verbos/guarda.mjs";
test("probe transcript-formato", () => {
  const l = (id, i, o) => JSON.stringify({ message: { id, usage: { input_tokens: i, output_tokens: o }, content: [] } });
  const m = medirTranscript([l("a", 3, 4), l("a", 3, 4), l("b", 1, 2)].join("\n"));
  assert.equal(m.achou, true); assert.equal(m.tokens, 10);
});
