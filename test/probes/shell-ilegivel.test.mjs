// probe shell-ilegivel (T67, fail-closed): o que o tokenizador não entende é negado, com o porquê.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo } from "../ajuda.mjs";
test("probe shell-ilegivel", async () => {
  const A = await alvo();
  for (const command of ["echo 'oi", "zeno status \"x", "cat <<EOF\nsem fim", "echo $(date"]) {
    const r = await A.cru(["guarda", "pre-tool"], "agente", { entrada: async () => JSON.stringify({ cwd: A.dir, tool_name: "Bash", tool_input: { command } }) });
    const d = JSON.parse(r.stdout || "{}").hookSpecificOutput;
    assert.equal(d?.permissionDecision, "deny", command);
    assert.match(d.permissionDecisionReason, /não entendeu/);
  }
});
