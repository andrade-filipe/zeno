// probe shell-por-parser (T67, D19): os falsos positivos literais (FP1, FP2 do 1º dia; FP3 da Observação da T67) passam
// pelo hook; leitura passa.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo } from "../ajuda.mjs";
import { FP1, FP2, FP3, FP4 } from "../fp-shell.mjs";
test("probe shell-por-parser", async () => {
  const A = await alvo();
  for (const command of [FP1, FP2, FP3, FP4, "cat .agents/ledger.jsonl", "node -e 'console.log(require(\"fs\").readFileSync(\".agents/ledger.jsonl\",\"utf8\").length)'"]) {
    const r = await A.cru(["guarda", "pre-tool"], "agente", { entrada: async () => JSON.stringify({ cwd: A.dir, tool_name: "Bash", tool_input: { command } }) });
    assert.equal(r.codigo, 0); assert.equal(r.stdout, "", command.slice(0, 80));
  }
});
