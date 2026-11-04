// sonda sessao-claude: no Bash do Claude Code, CLAUDE_CODE_SESSION_ID aponta para o transcript da sessão
// (<config>/projects/<pasta>/<id>.jsonl). A variável não é contrato público; se ela mudar, a CLI para de medir e esta
// sonda acusa. Fora do Claude Code (CI) ou sem a pasta de config à vista (sandbox), ela pula e diz por quê.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { transcriptDaSessao } from "../../core/gasto.mjs";

test("sonda sessao-claude: a variável da sessão acha o transcript", (t) => {
  const env = process.env, id = env.CLAUDE_CODE_SESSION_ID;
  if (!id) return t.skip("fora do Bash do Claude Code (sem CLAUDE_CODE_SESSION_ID)");
  const projetos = join(env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "projects");
  if (!existsSync(projetos)) return t.skip("a pasta de config do Claude Code não está à vista (sandbox)");
  const achou = transcriptDaSessao({ env, home: homedir() });
  assert.ok(achou, `CLAUDE_CODE_SESSION_ID=${id} não acha ${id}.jsonl em ${projetos}: o contrato da variável mudou`);
  assert.equal(basename(achou.principal), `${id}.jsonl`);
});
