// probe adocao-intacta (T74): adoção num harness rico. O harness do repo continua idêntico byte a byte fora do bloco do
// Zeno no AGENTS.md; o settings.json do repo não muda; as regras do Zeno (deny e hooks) vão no settings.local.json.
// Harness sintético (D35: nada de alvo cliente entra no zeno/).
import { test } from "node:test"; import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs"; import { join } from "node:path";
import { criarAlvo } from "../ajuda.mjs";
import { arquivoProtegido } from "../../core/protegidos.mjs";
import { carregar } from "../../core/config.mjs";
import { spawnSync } from "node:child_process";

const REPO = {
  "AGENTS.md": "# Projeto X\n\nRegras do time.\n- não apagar\n",
  "CLAUDE.md": "@AGENTS.md\n",
  "NOTAS.md": "notas do time\n",
  ".claude/settings.json": '{\n  "env": { "A": "", "B": "/dev/null" },\n  "permissions": {\n    "ask": [ "Edit(.claude/**)", "Edit(AGENTS.md)", "Edit(CLAUDE.md)" ],\n    "deny": [ "Read(**/.env)" ]\n  },\n  "hooks": {\n    "PreToolUse": [ { "matcher": "Bash", "hooks": [ { "type": "command", "command": "node", "args": ["guard.mjs"] } ] } ]\n  }\n}\n',
  ".claude/hooks/guard.mjs": "process.exit(0)\n",
  ".claude/skills/time/SKILL.md": "---\nname: time\n---\nskill do time\n",
};
const comPath = { which: () => true, rodar: () => ({ status: 0, ms: 0, stdout: "" }) };

test("probe adocao-intacta", async () => {
  const A = await criarAlvo({ antes: (dir) => { for (const [f, t] of Object.entries(REPO)) { mkdirSync(join(dir, f, ".."), { recursive: true }); writeFileSync(join(dir, f), t); } } }).pronto;
  const r = await A.z(["sync"], "agente", comPath);
  assert.equal(r.codigo, 0, r.stdout);
  // o harness do repo: idêntico byte a byte; T83: nem o bloco do Zeno entra no AGENTS.md commitado
  for (const [f, t] of Object.entries(REPO)) assert.equal(A.ler(f), t, `${f} mudou`);
  // as regras do Zeno: no local, com os hooks e só os protegidos do Zeno + os settings
  assert.ok(A.existe(".claude/settings.local.json"), "sem settings.local.json: o alvo adotado ficaria sem camadas 1 e 2");
  const s = JSON.parse(A.ler(".claude/settings.local.json"));
  assert.deepEqual(s.hooks.PreToolUse.map((h) => h.matcher), ["Bash", "Edit|Write|MultiEdit|NotebookEdit", "mcp__.*"]);
  // T83: o bloco viaja com as travas, pelo SessionStart do mesmo arquivo, e o comando entrega o texto do módulo
  assert.equal(s.hooks.SessionStart?.[0]?.hooks?.[0]?.command, "zeno contexto --bloco");
  const blk = await A.cru(["contexto", "--bloco"]);
  assert.equal(blk.codigo, 0); assert.match(blk.stdout, /Toda mudança de estado passa pela CLI `zeno`/);
  assert.ok(blk.stdout.length < 10000, "o teto documentado da saída do SessionStart é 10.000 caracteres");
  const deny = s.permissions.deny;
  for (const d of ["Edit(/.agents/ledger.jsonl)", "Edit(/.claude/settings.json)", "Edit(/.claude/settings.local.json)"]) assert.ok(deny.includes(d), d);
  assert.ok(!A.existe(".claude/skills/zeno-zeno"), "T81: na adoção o Zeno não põe skill no .claude/ do repo");
  for (const d of ["Edit(/CLAUDE.md)", "Edit(/.claude/**)"]) assert.ok(!deny.includes(d), `${d} tiraria do time o ask do repo`);
  // o hook de arquivo usa o mesmo rol
  const cfg = carregar(A.dir);
  assert.ok(arquivoProtegido(A.dir, cfg, ".claude/settings.json"));
  assert.equal(arquivoProtegido(A.dir, cfg, ".claude/skills/time/SKILL.md"), null);
  assert.equal(arquivoProtegido(A.dir, cfg, "CLAUDE.md"), null);
  // sync --check limpo; e de novo: nada muda
  assert.equal((await A.z(["sync", "--check"])).codigo, 0);
  assert.equal((await A.z(["sync"], "agente", comPath)).j.dados.gerados.length, 0);
  // T83: adoção antiga, com o bloco no AGENTS.md: o próximo sync o tira, e o resto volta byte a byte ao do repo
  A.escrever("AGENTS.md", REPO["AGENTS.md"] + "\n<!-- zeno:inicio nucleo -->\nbloco antigo\n<!-- zeno:fim nucleo -->\n");
  assert.equal((await A.z(["sync", "--check"])).codigo, 1, "o bloco antigo é deriva");
  assert.equal((await A.z(["sync"], "agente", comPath)).codigo, 0);
  assert.equal(A.ler("AGENTS.md"), REPO["AGENTS.md"]);
  // T83, a tentativa: sem a porta (outra máquina, o time: sem a CLI no PATH), o comando do Zeno falha e não escreve nó
  const antes = A.ledger().length;
  const t = spawnSync("sh", ["-c", 'zeno novo "x" --expressa --porque "y"'], { cwd: A.dir, env: { PATH: "/usr/bin:/bin" }, encoding: "utf8" });
  assert.notEqual(t.status, 0); assert.equal(A.ledger().length, antes, "sem a porta, nada é escrito");
  // local manual já existente: recusa sem tocar
  const B = await criarAlvo({ antes: (dir) => { mkdirSync(join(dir, ".claude"), { recursive: true }); writeFileSync(join(dir, ".claude/settings.json"), "{}\n"); writeFileSync(join(dir, ".claude/settings.local.json"), '{"meu":1}\n'); } }).pronto;
  const rb = await B.z(["sync"], "agente", comPath);
  assert.equal(rb.codigo, 1); assert.equal(rb.j.erros[0].regra, "adocao");
  assert.equal(B.ler(".claude/settings.local.json"), '{"meu":1}\n');
  assert.ok(existsSync(join(B.dir, ".claude/settings.json")) && readFileSync(join(B.dir, ".claude/settings.json"), "utf8") === "{}\n");
});
