// probe guarda-shell (C1/C3): o hook pre-tool nega escrita nos arquivos de controle, verbos de pessoa, ator e histórico.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo } from "../ajuda.mjs";
test("probe guarda-shell", async () => {
  const A = await alvo();
  for (const command of ["echo x >> .agents/ledger.jsonl", "zeno gate n --aprovar", "zeno caixa --aprovar", "sh -c \"zeno caixa --aprovar\"",
    "sed -i s/a/b/ .agents/sistema.yaml", "node -e \"require('fs').writeFileSync('.agents/faixas.yaml','')\"", "ZENO_ATOR=ana zeno avancar x", "git commit --no-verify -m x"]) {
    const r = await A.cru(["guarda", "pre-tool"], "agente", { entrada: async () => JSON.stringify({ cwd: A.dir, tool_name: "Bash", tool_input: { command } }) });
    assert.equal(JSON.parse(r.stdout || "{}").hookSpecificOutput?.permissionDecision, "deny", command);
  }
});
