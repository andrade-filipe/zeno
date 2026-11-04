// probe mcp-allowlist (T99): o agente só usa os servidores MCP da lista mcp: do alvo (padrão: nenhum), estendida pelo
// perfil dele em agentes:. O servidor novo, que ninguém pôs no deny estático, também é negado.
import { test } from "node:test"; import assert from "node:assert/strict";
import { alvo } from "../ajuda.mjs";
const hook = (A, ferramenta) => A.cru(["guarda", "pre-tool"], "agente", { entrada: async () => JSON.stringify({ cwd: A.dir, session_id: "s1", tool_name: ferramenta, tool_input: {} }) });
const negado = (r) => r.stdout !== "" && JSON.parse(r.stdout).hookSpecificOutput.permissionDecision === "deny";

test("probe mcp-allowlist", async () => {
  const A = await alvo();
  const gmail = await hook(A, "mcp__claude_ai_Gmail__send_message");
  assert.ok(negado(gmail), "padrão nenhum: o Gmail é negado");
  assert.match(JSON.parse(gmail.stdout).hookSpecificOutput.permissionDecisionReason, /claude_ai_Gmail não está na lista mcp:/);
  assert.ok(negado(await hook(A, "mcp__servidor_novo__qualquer")), "o servidor novo também");
  const rec = A.ledger().filter((e) => e.ev === "recusa" && e.dados.regra === "mcp-fora-da-lista");
  assert.deepEqual(rec.map((e) => e.dados.servidor), ["claude_ai_Gmail", "servidor_novo"]);

  const sis = A.ler(".agents", "sistema.yaml");
  A.escrever(".agents/sistema.yaml", sis + "\nmcp: [claude_ai_Gmail]\n");
  assert.equal((await hook(A, "mcp__claude_ai_Gmail__search_threads")).stdout, "", "listado no alvo: passa");
  assert.ok(negado(await hook(A, "mcp__monday__create_item")), "o resto segue negado");

  // o perfil do agente estende a lista do alvo (o ator do hook do Claude Code é ia:claude)
  A.escrever(".agents/sistema.yaml", (sis + "\nmcp: [claude_ai_Gmail]\n").replace(/^agentes:.*$/m, 'agentes:\n  "ia:claude":\n    mcp: [monday]'));
  assert.equal((await hook(A, "mcp__monday__create_item")).stdout, "", "listado no perfil: passa");
  assert.ok(negado(await hook(A, "mcp__vercel__create_deployment")));
});
