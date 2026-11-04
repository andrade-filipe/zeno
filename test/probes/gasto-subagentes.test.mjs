// probe gasto-subagentes: os transcripts dos subagentes (<sessão>/subagents/agent-*.jsonl) entram na medição da sessão.
// A 2ª parte é sonda do ambiente: se esta máquina tem subagentes do Claude Code gravados, o formato deles é o que o
// leitor acha (message.id + usage). Sem nenhum (CI, sandbox), ela pula e diz por quê.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { raizTmp as tmpdir } from "../ajuda.mjs"; // apagada no exit do processo (tmp-limpo)
import { lerSessao } from "../../core/gasto.mjs";
import { medirTranscript } from "../../core/verbos/guarda.mjs";

const l = (id, n) => JSON.stringify({ type: "assistant", message: { id, role: "assistant", usage: { input_tokens: n, output_tokens: 0 }, content: [] } });

test("probe gasto-subagentes: principal + 2 subagentes somam, sem dobra por message.id", () => {
  const d = mkdtempSync(join(tmpdir(), "zeno-probe-sub-"));
  const tp = join(d, "sessao-1.jsonl");
  writeFileSync(tp, l("a", 10) + "\n");
  mkdirSync(join(d, "sessao-1", "subagents"), { recursive: true });
  writeFileSync(join(d, "sessao-1", "subagents", "agent-x.jsonl"), [l("b", 5), l("a", 10)].join("\n"));
  writeFileSync(join(d, "sessao-1", "subagents", "agent-y.jsonl"), l("c", 1));
  writeFileSync(join(d, "sessao-1", "subagents", "agent-y.meta.json"), "{}");
  const m = lerSessao(tp);
  assert.equal(m.subagentes, 2);
  assert.equal(m.tokens, 16);
});

test("sonda: os subagentes gravados nesta máquina seguem o formato lido", (t) => {
  const base = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "projects");
  const achados = [];
  try {
    for (const p of readdirSync(base)) for (const s of readdirSync(join(base, p))) {
      const dir = join(base, p, s, "subagents");
      if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
      for (const f of readdirSync(dir)) if (/^agent-.*\.jsonl$/.test(f)) achados.push(join(dir, f));
      if (achados.length >= 5) break;
    }
  } catch {}
  if (!achados.length) return t.skip("nenhum subagente do Claude Code à vista (CI ou sandbox)");
  const algum = achados.some((f) => { const m = medirTranscript(readFileSync(f, "utf8")); return m.achou && m.tokens > 0; });
  assert.ok(algum, `nenhum dos ${achados.length} subagentes tem message.id + usage: o formato mudou`);
});
