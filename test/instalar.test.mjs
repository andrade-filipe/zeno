// install e sync em fixture (nunca no zeno/ de verdade): gerados, cabeçalho, deny da camada 1, fail-closed, deriva, PATH e fumaça.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { alvo, criarAlvo, gitReal, raizTmp as tmpdir } from "./ajuda.mjs";
import { run } from "../core/run.mjs";
import { chamaOGerado } from "../core/verbos/instalar.mjs";
import { carregar } from "../core/config.mjs";
import { adotado, arquivoProtegido } from "../core/protegidos.mjs";

const comPath = { which: () => true, rodar: () => ({ status: 0, ms: 1, stdout: "" }) };

test("sync recusa gerar settings sem o zeno no PATH; gera só o AGENTS.md no install --sem-sync", async () => {
  const A = await alvo();
  assert.match(A.ler("AGENTS.md"), /<!-- zeno:inicio nucleo -->/);
  assert.ok(!A.existe("CLAUDE.md"));
  const r = await A.z(["sync"]);
  assert.equal(r.codigo, 1);
  assert.match(r.stdout + JSON.stringify(r.j), /PATH/);
  assert.match(r.stdout, /Antes do 1º zeno promover/, "sem cópia fixada: o ln -s do clone é o bootstrap (no erro do --json)");
  assert.ok(!A.existe(".claude/settings.json"));
  // com cópia fixada, o ln -s do clone a desligaria: a mensagem manda pôr no PATH o shim do promover
  mkdirSync(join(A.home, ".local", "share", "zeno", "atual"), { recursive: true });
  const f = await A.z(["sync"]);
  assert.equal(f.codigo, 1);
  assert.match(f.stdout, /Há cópia fixada/);
  assert.match(f.stdout, /Não ligue o bin\/zeno do clone/);
});

test("sync recusa quando a fumaça do hook nega um comando benigno", async () => {
  const A = await alvo();
  const r = await A.z(["sync"], "agente", { which: () => true, rodar: () => ({ status: 0, ms: 1, stdout: '{"permissionDecision":"deny"}' }) });
  assert.equal(r.codigo, 1);
  assert.ok(!A.existe(".claude/settings.json"));
  const r2 = await A.z(["sync"], "agente", { which: () => true, rodar: () => ({ status: 2, ms: 1, stdout: "" }) });
  assert.equal(r2.codigo, 1);
});

test("sync gera CLAUDE.md, settings.json, skill e lock; --check passa; editar um gerado é deriva", async () => {
  const A = await alvo();
  const r = await A.z(["sync"], "agente", comPath);
  assert.equal(r.codigo, 0, r.stdout + JSON.stringify(r.j?.erros));
  assert.match(A.ler("CLAUDE.md"), /^<!-- GERADO pelo zeno sync; não edite\. Fonte: AGENTS\.md -->\n@AGENTS\.md\n$/);
  const s = JSON.parse(A.ler(".claude/settings.json"));
  const deny = s.permissions.deny.join("\n");
  for (const f of [".agents/ledger.jsonl", ".agents/trabalho/*.fio.md", ".agents/gerados.lock", ".agents/sistema.yaml", ".agents/faixas.yaml", "CLAUDE.md", ".claude/**"]) assert.ok(s.permissions.deny.includes(`Edit(/${f})`), f);
  assert.ok(!deny.includes("Write("), "regra de caminho em Write nunca casa (docs): não é gerada");
  assert.ok(!deny.includes(A.dir), "nenhum caminho absoluto do checkout (T69)");
  assert.equal(s.hooks.PreToolUse[0].hooks[0].command, "zeno guarda pre-tool || exit 2");
  assert.equal(s.hooks.PreToolUse[1].matcher, "Edit|Write|MultiEdit|NotebookEdit");
  assert.equal(s.hooks.PreToolUse[1].hooks[0].command, "zeno guarda pre-tool || exit 2");
  assert.equal(s.hooks.PostToolUse[0].hooks[0].command, "zeno guarda contaminou || exit 2");
  assert.equal(s.hooks.SessionEnd[0].hooks[0].command, "zeno guarda fim-sessao || true");
  assert.ok(A.existe(".claude/skills/zeno-zeno/SKILL.md"));
  assert.match(A.ler(".claude/skills/zeno-zeno/SKILL.md"), /GERADO pelo zeno sync/);
  assert.match(A.ler(".agents/gerados.lock"), /CLAUDE\.md/);
  assert.equal((await A.z(["sync", "--check"])).codigo, 0);
  A.escrever("CLAUDE.md", "editado à mão\n");
  const c = await A.z(["sync", "--check"]);
  assert.equal(c.codigo, 1);
  assert.deepEqual(c.j.dados.deriva, ["CLAUDE.md"]);
  assert.equal((await A.z(["sync"], "agente", comPath)).codigo, 0, "gerado no lock é regenerado");
  assert.equal((await A.z(["sync", "--check"])).codigo, 0);
});

test("sync não sobrescreve arquivo manual no caminho de um gerado; parte manual do AGENTS.md fica byte a byte", async () => {
  const A = await alvo();
  A.escrever("CLAUDE.md", "meu CLAUDE manual\n");
  const r = await A.z(["sync"], "agente", comPath);
  assert.equal(r.codigo, 1);
  assert.equal(A.ler("CLAUDE.md"), "meu CLAUDE manual\n");
  const ag = A.ler("AGENTS.md").replace("<!-- Parte manual: escreva aqui. O bloco do Zeno abaixo é gerado. -->", "Regra minha: nada de pressa.");
  A.escrever("AGENTS.md", ag);
  A.escrever("CLAUDE.md", "");
  A.escrever(".agents/sistema.yaml", A.ler(".agents/sistema.yaml").replace("local: []", 'local: ["CLAUDE.md"]'));
  assert.equal((await A.z(["sync"], "agente", comPath)).codigo, 0);
  assert.match(A.ler("AGENTS.md"), /Regra minha: nada de pressa\./);
  assert.equal(A.ler("CLAUDE.md"), "", "declarado em local: o sync não toca");
});

test("deny da camada 1 que não casa com nada recusa o sync", async () => {
  const A = await alvo();
  A.escrever(".agents/sistema.yaml", A.ler(".agents/sistema.yaml").replace("negar_escrita: []", 'negar_escrita: ["../nao-existe-mesmo"]'));
  const r = await A.z(["sync"], "agente", comPath);
  assert.equal(r.codigo, 1);
  assert.equal(r.j.erros[0].regra, "deny-camada1");
});

test("install: recusa harness existente sem --adocao; com --adocao declara os locais", async () => {
  const dir = mkdtempSync(join(tmpdir(), "zeno-adocao-"));
  writeFileSync(join(dir, "CLAUDE.md"), "manual\n");
  const ctx = { cwd: dir, env: { CLAUDECODE: "1" }, isTTY: false, home: dir, agora: () => Date.now(), git: (a) => ({ status: 0, stdout: a[1] === "user.name" ? "Bia Souza\n" : "bia@x\n" }), which: () => false, rodar: () => ({ status: 0, ms: 0, stdout: "" }) };
  assert.equal((await run(["install", ".", "--sem-sync"], ctx)).codigo, 1);
  const r = await run(["install", ".", "--adocao", "--sem-sync", "--json"], ctx);
  assert.equal(r.codigo, 0, r.stdout);
  const sis = readFileSync(join(dir, ".agents", "sistema.yaml"), "utf8");
  assert.match(sis, /local: \["CLAUDE\.md"\]/);
  assert.match(sis, /pessoas:\n  bia:\n    git: "bia@x"/);
  assert.match(readFileSync(join(dir, ".agents", ".gitattributes"), "utf8"), /ledger\.jsonl merge=union/);
  assert.equal((await run(["install", ".", "--adocao"], ctx)).codigo, 1, "já instalado");
});

test("install num worktree ligado tira o nome do alvo do checkout principal, não da pasta do worktree (T77)", async () => {
  const base = mkdtempSync(join(tmpdir(), "zeno-wt-")), main = join(base, "meu-alvo"), wt = join(base, "zeno-piloto");
  mkdirSync(main);
  for (const a of [["init", "-q", "-b", "main"], ["commit", "-q", "--allow-empty", "-m", "x"], ["worktree", "add", "-q", wt]]) gitReal(a, { cwd: main });
  const ctx = { cwd: wt, env: { CLAUDECODE: "1" }, isTTY: false, home: base, agora: () => Date.now(), which: () => false, rodar: () => ({ status: 0, ms: 0, stdout: "" }),
    git: (a, o) => (a[0] === "config" ? { status: 0, stdout: a[1] === "user.name" ? "Bia Souza\n" : "bia@x\n" } : gitReal(a, o)) };
  assert.equal((await run(["install", wt, "--sem-sync"], ctx)).codigo, 0);
  assert.match(readFileSync(join(wt, ".agents", "sistema.yaml"), "utf8"), /^alvo: meu-alvo$/m);
});

test("status num alvo adotado reconhece as camadas no settings.local.json gerado (T77)", async () => {
  const A = await criarAlvo({ antes: (dir) => { mkdirSync(join(dir, ".claude"), { recursive: true }); writeFileSync(join(dir, ".claude", "settings.json"), "{}\n"); } }).pronto;
  const aviso = async () => (await A.z(["status"])).j.dados.avisos.join("\n");
  assert.match(await aviso(), /camadas 1–2 ausentes neste alvo adotado/, "antes do sync o aviso vale");
  assert.equal((await A.z(["sync"], "agente", comPath)).codigo, 0);
  assert.doesNotMatch(await aviso(), /camadas 1–2 ausentes/);
});

test("adoção declara em local todo o harness que já existia; AGENTS.md fica fora (T77)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "zeno-rico-"));
  for (const f of ["CLAUDE.md", "AGENTS.md", "NOTAS.md", ".claude/settings.json", ".claude/hooks/g.mjs", ".claude/skills/time/SKILL.md", ".claude/comandos.md", "bench/run.mjs", "scripts/x.sh"]) {
    mkdirSync(join(dir, f, ".."), { recursive: true }); writeFileSync(join(dir, f), "x\n");
  }
  const ctx = { cwd: dir, env: { CLAUDECODE: "1" }, isTTY: false, home: dir, agora: () => Date.now(), git: (a) => ({ status: 0, stdout: a[1] === "user.name" ? "Bia Souza\n" : "bia@x\n" }), which: () => false, rodar: () => ({ status: 0, ms: 0, stdout: "" }) };
  assert.equal((await run(["install", ".", "--adocao", "--sem-sync"], ctx)).codigo, 0);
  const local = carregar(dir).local;
  assert.deepEqual([...local].sort(), [".claude/comandos.md", ".claude/hooks/", ".claude/settings.json", ".claude/skills/time/", "CLAUDE.md", "NOTAS.md", "bench/", "scripts/"].sort());
});

test("T94/T113: adoção sem .claude/settings.json: no pessoal a fiação vai versionada; com fiacao: local, no settings.local.json", async () => {
  const REPO = { "AGENTS.md": "# Projeto Y\n\nRegras do time.\n", "CLAUDE.md": "@AGENTS.md\n" };
  const A = await criarAlvo({ git: true, antes: (dir) => { for (const [f, t] of Object.entries(REPO)) writeFileSync(join(dir, f), t); } }).pronto;
  assert.match(A.ler(".agents/sistema.yaml"), /^adocao: true$/m, "o install grava a adoção");
  const cfg = carregar(A.dir);
  assert.equal(cfg.local.includes(".claude/settings.json"), false);
  assert.equal(adotado(cfg), true, "adotado sem settings.json no local");
  // T113: a fiação do pessoal adotado é o settings.json versionado (um clone novo nasce com as travas e a deixa)
  const r = await A.z(["sync"], "agente", comPath);
  assert.equal(r.codigo, 0, r.stdout);
  assert.equal(A.existe(".claude/settings.local.json"), false);
  const v = JSON.parse(A.ler(".claude/settings.json"));
  assert.deepEqual(v.hooks.PreToolUse.map((h) => h.matcher), ["Bash", "Edit|Write|MultiEdit|NotebookEdit", "mcp__.*"]);
  assert.equal(v.hooks.Stop[0].hooks[0].command, "zeno guarda parar || true");
  assert.equal(v.hooks.SessionStart[0].hooks[0].command, "zeno contexto --bloco", "o bloco segue pela porta: o AGENTS.md é do repo");
  for (const [f, t] of Object.entries(REPO)) assert.equal(A.ler(f), t, `${f} mudou`);
  assert.match(A.ler(".agents/gerados.lock"), /  \.claude\/settings\.json  /);
  assert.equal((await A.z(["sync", "--check"])).codigo, 0);
  assert.doesNotMatch((await A.z(["status"])).j.dados.avisos.join("\n"), /camadas 1–2 ausentes/, "o status reconhece a fiação versionada");
  // a saída: fiacao: local volta a fiação para o settings.local.json, e o versionado gerado vai para o _lixo
  A.escrever(".agents/sistema.yaml", A.ler(".agents/sistema.yaml") + "fiacao: local\n");
  assert.equal((await A.z(["sync"], "agente", comPath)).codigo, 0);
  assert.equal(A.existe(".claude/settings.json"), false, "fiacao: local: nada de settings.json versionado");
  assert.ok(readdirSync(join(A.dir, ".agents/_lixo")).some((f) => f.endsWith(".claude__settings.json")), "nunca apagar: o versionado vai para o _lixo");
  const s = JSON.parse(A.ler(".claude/settings.local.json"));
  assert.deepEqual(s.hooks.PreToolUse.map((h) => h.matcher), ["Bash", "Edit|Write|MultiEdit|NotebookEdit", "mcp__.*"]);
  assert.equal(s.hooks.Stop[0].hooks[0].command, "zeno guarda parar || true");
  assert.ok(readFileSync(join(A.dir, ".git", "info", "exclude"), "utf8").split("\n").includes("/.claude/settings.local.json"), "o local fica fora do git");
  const cfgL = carregar(A.dir);
  assert.equal(arquivoProtegido(A.dir, cfgL, "CLAUDE.md"), null, "o CLAUDE.md é do repo (T74)");
  assert.ok(arquivoProtegido(A.dir, cfgL, ".agents/sistema.yaml"));
  assert.equal((await A.z(["sync", "--check"])).codigo, 0);
  // os adotados de antes da T94 (sem o campo) seguem reconhecidos pelo settings.json no local; um alvo novo não é adotado
  assert.equal(adotado({ local: [".claude/settings.json"] }), true);
  assert.equal(adotado({ local: [] }), false);
});

test("adoção põe o settings.local.json no info/exclude do clone; sync --check acusa se faltar (T77)", async () => {
  const A = await criarAlvo({ git: true, antes: (dir) => { mkdirSync(join(dir, ".claude"), { recursive: true }); writeFileSync(join(dir, ".claude", "settings.json"), "{}\n"); } }).pronto;
  assert.equal((await A.z(["sync"], "agente", comPath)).codigo, 0);
  const ex = join(A.dir, ".git", "info", "exclude");
  assert.ok(readFileSync(ex, "utf8").split("\n").includes("/.claude/settings.local.json"));
  assert.equal(gitReal(["check-ignore", "-q", "--no-index", ".claude/settings.local.json"], { cwd: A.dir }).status, 0, "o git do clone ignora");
  assert.equal((await A.z(["sync", "--check"])).codigo, 0);
  writeFileSync(ex, readFileSync(ex, "utf8").replace("/.claude/settings.local.json\n", ""));
  const c = await A.z(["sync", "--check"]);
  assert.equal(c.codigo, 1);
  assert.deepEqual(c.j.dados.deriva, [".git/info/exclude"]);
  assert.equal(A.ler(".claude/settings.json"), "{}\n", "o harness do repo não muda");
});

test("adoção não gera skill no .claude do repo; a zeno-* de adoção antiga vai para .agents/_lixo (T81)", async () => {
  const A = await criarAlvo({ antes: (dir) => { mkdirSync(join(dir, ".claude"), { recursive: true }); writeFileSync(join(dir, ".claude", "settings.json"), "{}\n"); } }).pronto;
  assert.equal((await A.z(["sync"], "agente", comPath)).codigo, 0);
  assert.ok(!A.existe(".claude/skills/zeno-zeno/SKILL.md"));
  // uma adoção antiga: a skill gerada e a linha dela no lock
  mkdirSync(join(A.dir, ".claude/skills/zeno-zeno"), { recursive: true }); A.escrever(".claude/skills/zeno-zeno/SKILL.md", "skill antiga\n");
  A.escrever(".agents/gerados.lock", A.ler(".agents/gerados.lock") + "abc  .claude/skills/zeno-zeno/SKILL.md  nucleo@0.1.0/skills/zeno\n");
  assert.deepEqual((await A.z(["sync", "--check"])).j.dados.deriva, [".agents/gerados.lock", ".claude/skills/zeno-zeno/SKILL.md"], "o órfão e o lock que ainda o cita");
  assert.equal((await A.z(["sync"], "agente", comPath)).codigo, 0);
  assert.ok(!A.existe(".claude/skills/zeno-zeno"), "a pasta vazia do órfão também sai");
  assert.ok(readdirSync(join(A.dir, ".agents/_lixo")).some((f) => f.endsWith(".claude__skills__zeno-zeno__SKILL.md")), "nunca apagar: vai para o _lixo");
  assert.equal((await A.z(["sync", "--check"])).codigo, 0);
  // um gerado que a pessoa assumiu (declarado em local) não é órfão: fica onde está
  const B = await alvo();
  assert.equal((await B.z(["sync"], "agente", comPath)).codigo, 0);
  B.escrever("CLAUDE.md", "meu CLAUDE, assumido\n");
  B.escrever(".agents/sistema.yaml", B.ler(".agents/sistema.yaml").replace("local: []", 'local: ["CLAUDE.md"]'));
  assert.equal((await B.z(["sync"], "agente", comPath)).codigo, 0);
  assert.equal(B.ler("CLAUDE.md"), "meu CLAUDE, assumido\n", "local nunca vai para o _lixo");
});

test("install COM sync num diretório novo gera tudo (o lock ainda não existe; achado do plano a seco da T74)", async () => {
  for (const extra of [[], ["--fronteira", "cliente"]]) {
    const dir = mkdtempSync(join(tmpdir(), "zeno-novo-"));
    const ctx = { cwd: dir, env: { CLAUDECODE: "1" }, isTTY: false, home: dir, agora: () => Date.now(), git: (a) => ({ status: 0, stdout: a[1] === "user.name" ? "Bia Souza\n" : "bia@x\n" }), which: () => true, rodar: () => ({ status: 0, ms: 0, stdout: "" }) };
    const r = await run(["install", ".", ...extra], ctx);
    assert.equal(r.codigo, 0, r.stdout + r.stderr);
    for (const f of [".claude/settings.json", ".agents/gerados.lock", "CLAUDE.md", "AGENTS.md"]) assert.ok(existsSync(join(dir, f)), f);
  }
});

test("T83: o comando do SessionStart, rodado de verdade num alvo adotado, sai no formato do hook e com o bloco inteiro", async () => {
  const { spawnSync } = await import("node:child_process");
  const A = await criarAlvo({ antes: (d) => { mkdirSync(join(d, ".claude"), { recursive: true }); writeFileSync(join(d, ".claude/settings.json"), "{}\n"); writeFileSync(join(d, "AGENTS.md"), "# Repo\n"); } }).pronto;
  assert.equal((await A.z(["sync"], "agente", { which: () => true, rodar: () => ({ status: 0, ms: 0, stdout: "" }) })).codigo, 0);
  const cmd = JSON.parse(A.ler(".claude/settings.local.json")).hooks.SessionStart[0].hooks[0].command;
  assert.equal(cmd, "zeno contexto --bloco");
  const cli = new URL("../cli.mjs", import.meta.url).pathname;
  const r = spawnSync(process.execPath, [cli, ...cmd.split(" ").slice(1)], { cwd: A.dir, encoding: "utf8", env: { PATH: process.env.PATH, HOME: A.home } });
  assert.equal(r.status, 0, r.stderr);
  const h = JSON.parse(r.stdout).hookSpecificOutput;
  assert.equal(h.hookEventName, "SessionStart");
  const frag = readFileSync(new URL("../modulos/nucleo/agents-md.md", import.meta.url), "utf8").trim();
  assert.ok(h.additionalContext.startsWith(frag), "o bloco do módulo sai inteiro, byte a byte");
  assert.ok(r.stdout.length < 10000, "o teto documentado da saída do SessionStart é 10.000 caracteres");
});

test("T99: o settings gera o hook mcp__.* e o deny dos MCP de escrita conhecidos, menos os listados no alvo ou num perfil", async () => {
  const A = await alvo();
  assert.equal((await A.z(["sync"], "agente", comPath)).codigo, 0);
  let s = JSON.parse(A.ler(".claude", "settings.json"));
  assert.ok(s.hooks.PreToolUse.some((h) => h.matcher === "mcp__.*" && /zeno guarda pre-tool/.test(h.hooks[0].command)));
  for (const srv of ["claude_ai_Gmail", "claude_ai_Google_Drive", "vercel", "aws-mcp", "monday", "claude-in-chrome"]) assert.ok(s.permissions.deny.includes(`mcp__${srv}`), srv);
  A.escrever(".agents/sistema.yaml", A.ler(".agents", "sistema.yaml").replace(/^agentes:.*$/m, 'agentes:\n  "ia:claude":\n    mcp: [monday]') + "\nmcp: [vercel]\n");
  assert.equal((await A.z(["sync"], "agente", comPath)).codigo, 0);
  s = JSON.parse(A.ler(".claude", "settings.json"));
  assert.ok(!s.permissions.deny.includes("mcp__vercel"), "listado no alvo: fora do deny");
  assert.ok(!s.permissions.deny.includes("mcp__monday"), "listado num perfil: fora do deny");
  assert.ok(s.permissions.deny.includes("mcp__claude_ai_Gmail"));
});

test("T97: o gate de commit do alvo roda no git de verdade: falha fechado sem zeno; passa coerente; para o ledger editado à mão", async (t) => {
  const A = await criarAlvo({ git: true }).pronto;
  assert.equal((await A.z(["sync"], "agente", comPath)).codigo, 0);
  const casa = mkdtempSync(join(tmpdir(), "zeno-casa-")), bin = mkdtempSync(join(tmpdir(), "zeno-bin-"));
  const cli = new URL("../cli.mjs", import.meta.url).pathname;
  const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_") && k !== "CLAUDECODE"));
  const commit = (path) => spawnSync("git", ["-c", "user.name=Ana Teste", "-c", "user.email=ana@teste", "-c", "commit.gpgsign=false", "commit", "-qm", "x"],
    { cwd: A.dir, encoding: "utf8", env: { ...base, HOME: casa, PATH: path } });
  const sistema = `${dirname(process.execPath)}:/usr/bin:/bin`;
  gitReal(["add", "-A"], { cwd: A.dir });
  // Com a cópia do root ativa (/opt/zeno, bloco C da T95), o hook gerado acha o juiz do root, e o caso "sem zeno" não
  // se simula nesta máquina; na prova do promover (bwrap, sem /opt) ele roda.
  if (existsSync("/opt/zeno/atual/cli.mjs")) {
    t.diagnostic("a cópia do root está ativa: o caso falha-fechado-sem-zeno do T97 fica para a prova do promover");
  } else {
    const sem = commit(sistema);
    assert.notEqual(sem.status, 0, "sem zeno: o commit para");
    assert.match(sem.stderr, /falha fechado/);
  }
  writeFileSync(join(bin, "zeno"), `#!/bin/sh\nexec "${process.execPath}" "${cli}" "$@"\n`, { mode: 0o755 });
  // T113: um nó no commit, para o teste não depender de quem o roda (um agente acima pararia o commit sem nó)
  assert.equal((await A.z(["novo", "Gate de commit", "--expressa", "--porque", "teste"])).codigo, 0);
  gitReal(["add", "-A"], { cwd: A.dir });
  const ok = commit(`${bin}:${sistema}`);
  assert.equal(ok.status, 0, ok.stderr);
  const linhas = readFileSync(A.caminho(".agents/ledger.jsonl"), "utf8").split("\n").filter(Boolean);
  assert.ok(linhas.length > 1);
  writeFileSync(A.caminho(".agents/ledger.jsonl"), linhas.slice(1).join("\n") + "\n");
  gitReal(["add", "-A"], { cwd: A.dir });
  const forjado = commit(`${bin}:${sistema}`);
  assert.notEqual(forjado.status, 0, "ledger truncado à mão: o commit para");
  assert.match(forjado.stdout + forjado.stderr, /append-only/);
});

test("T111: githooks_encadeado reconhece o gate já encadeado; sem a chave o aviso segue; o que falta é nomeado", async () => {
  const CHAVE = "\ngithooks_encadeado: .githooks/\n", GATE = 'node "$juiz" validar --staged\nnode "$juiz" sync --check\n';
  const montar = async (extra, hooks) => {
    const A = await criarAlvo({ git: true, extra }).pronto;
    gitReal(["config", "--local", "core.hooksPath", ".githooks"], { cwd: A.dir });
    mkdirSync(A.caminho(".githooks"));
    for (const [n, t] of Object.entries(hooks)) writeFileSync(A.caminho(".githooks", n), t, { mode: 0o755 });
    return A;
  };
  const gh = (r) => r.j.avisos.filter((a) => a.regra === "githooks").map((a) => a.msg);
  // (1) a pasta cobre: o sync diz coberto, o sync --check cala; (4) o core.hooksPath e os gerados não mudam
  const A = await montar(CHAVE, { "pre-commit": GATE, "pre-merge-commit": GATE });
  const r = await A.z(["sync"], "agente", comPath);
  assert.equal(r.codigo, 0, r.stdout);
  assert.equal(r.j.dados.githooks, "gate de commit coberto por .githooks/pre-commit e pre-merge-commit (githooks_encadeado)");
  assert.deepEqual(gh(r), []);
  const c = await A.z(["sync", "--check"], "agente", comPath);
  assert.equal(c.codigo, 0, c.stdout);
  assert.deepEqual(gh(c), []);
  assert.equal(gitReal(["config", "--local", "--get", "core.hooksPath"], { cwd: A.dir }).stdout.trim(), ".githooks");
  assert.equal(gitReal(["config", "--local", "--get", "zeno.githooks"], { cwd: A.dir }).stdout.trim(), "");
  // (2) sem a chave: o aviso de encadear de hoje
  const B = await montar("", { "pre-commit": GATE, "pre-merge-commit": GATE });
  assert.equal((await B.z(["sync"], "agente", comPath)).codigo, 0);
  assert.deepEqual(gh(await B.z(["sync", "--check"], "agente", comPath)), ["o clone já tem hooks (core.hooksPath=.githooks): o gate de commit do Zeno não foi ligado; encadeie no seu pre-commit e pre-merge-commit: sh .agents/githooks/pre-commit"]);
  for (const n of ["pre-commit", "pre-merge-commit"]) assert.equal(A.ler(".agents", "githooks", n), B.ler(".agents", "githooks", n), `a chave não muda o gerado ${n}`);
  // (3) falta um arquivo, e o outro não chama o sync --check: o aviso nomeia os dois
  const C = await montar(CHAVE, { "pre-commit": 'node "$juiz" validar --staged\n' });
  assert.equal((await C.z(["sync"], "agente", comPath)).codigo, 0);
  assert.deepEqual(gh(await C.z(["sync", "--check"], "agente", comPath)), ["githooks_encadeado: .githooks não cobre o gate de commit: .githooks/pre-commit não chama sync --check; .githooks/pre-merge-commit não existe; o gate do Zeno não foi ligado"]);
});

test("T116: githooks_encadeado aceita o hook que chama o gerado de mesmo nome; o caminho num comentário não cobre", async () => {
  const CHAVE = "\ngithooks_encadeado: .githooks/\n";
  const montar = async (hooks) => {
    const A = await criarAlvo({ git: true, extra: CHAVE }).pronto;
    gitReal(["config", "--local", "core.hooksPath", ".githooks"], { cwd: A.dir });
    mkdirSync(A.caminho(".githooks"));
    for (const [n, t] of Object.entries(hooks)) writeFileSync(A.caminho(".githooks", n), t, { mode: 0o755 });
    return A;
  };
  const gh = (r) => r.j.avisos.filter((a) => a.regra === "githooks").map((a) => a.msg);
  // o encadeamento da avaliacao/: exec sh do gerado
  const A = await montar({ "pre-commit": "#!/bin/sh\nexec sh .agents/githooks/pre-commit\n", "pre-merge-commit": '#!/bin/sh\nset -e\nbash "./.agents/githooks/pre-merge-commit" "$@"\n' });
  const r = await A.z(["sync"], "agente", comPath);
  assert.equal(r.codigo, 0, r.stdout);
  assert.equal(r.j.dados.githooks, "gate de commit coberto por .githooks/pre-commit e pre-merge-commit (githooks_encadeado)");
  assert.deepEqual(gh(await A.z(["sync", "--check"], "agente", comPath)), []);
  // só no comentário: falta, com a mesma mensagem de antes
  const B = await montar({ "pre-commit": "#!/bin/sh\n# exec sh .agents/githooks/pre-commit\nexit 0\n", "pre-merge-commit": "#!/bin/sh\necho ok # sh .agents/githooks/pre-merge-commit\n" });
  assert.equal((await B.z(["sync"], "agente", comPath)).codigo, 0);
  assert.deepEqual(gh(await B.z(["sync", "--check"], "agente", comPath)), ["githooks_encadeado: .githooks não cobre o gate de commit: .githooks/pre-commit não chama validar --staged nem sync --check; .githooks/pre-merge-commit não chama validar --staged nem sync --check; o gate do Zeno não foi ligado"]);
  // a regra, linha a linha
  for (const t of ["exec sh .agents/githooks/pre-commit", "sh .agents/githooks/pre-commit", "bash .agents/githooks/pre-commit", "exec .agents/githooks/pre-commit \"$@\"",
    "exec sh zeno/.agents/githooks/pre-commit", "  sh \"$raiz/.agents/githooks/pre-commit\" || exit 1", "cd x && sh .agents/githooks/pre-commit"]) assert.equal(chamaOGerado(t, "pre-commit"), true, t);
  for (const t of ["# exec sh .agents/githooks/pre-commit", "echo x # sh .agents/githooks/pre-commit", "cat .agents/githooks/pre-commit", "sh .agents/githooks/pre-merge-commit",
    "sh .agents/githooks/pre-commit.bak", "sh .agents/githooks/pre-commit-velho", "echo sh", ""]) assert.equal(chamaOGerado(t, "pre-commit"), false, t);
});

test("T112: adoção num worktree diz que o exclude é o do checkout principal; .gitignore que cobre não escreve; dica da chave", async () => {
  // (1) worktree ligado, HOME temporário sem chave: a saída nomeia o exclude do checkout principal e sugere chave nova
  const base = mkdtempSync(join(tmpdir(), "zeno-wtx-")), main = join(base, "repo"), wt = join(base, "wt");
  mkdirSync(main);
  for (const a of [["init", "-q", "-b", "main"], ["commit", "-q", "--allow-empty", "-m", "x"], ["worktree", "add", "-q", wt]]) gitReal(a, { cwd: main });
  mkdirSync(join(wt, ".claude")); writeFileSync(join(wt, ".claude", "settings.json"), "{}\n");
  const ctx = { cwd: wt, env: { CLAUDECODE: "1" }, isTTY: false, home: base, agora: () => Date.now(), ...comPath,
    git: (a, o) => (a[0] === "config" && a[1]?.startsWith("user.") ? { status: 0, stdout: a[1] === "user.name" ? "Bia Souza\n" : "bia@x\n" } : gitReal(a, o)) };
  const r = await run(["install", wt, "--adocao"], ctx);
  assert.equal(r.codigo, 0, r.stdout + r.stderr);
  const ex = join(realpathSync(main), ".git", "info", "exclude");
  assert.ok(r.stdout.includes(`worktree ligado: a linha /.claude/settings.local.json foi no info/exclude do checkout principal (${ex})`), r.stdout);
  assert.ok(readFileSync(ex, "utf8").split("\n").includes("/.claude/settings.local.json"));
  assert.match(r.stdout, /chave_pub de bia vazia: .*zeno chave nova/);
  assert.match(readFileSync(join(wt, ".agents", "sistema.yaml"), "utf8"), /chave_pub: null/, "o install não grava a chave");
  // (4) com o arquivo da chave na casa (fixture, nunca aberto pelo install): sugere chave pub, e segue sem gravar
  const casa = mkdtempSync(join(tmpdir(), "zeno-casa-")), dir = mkdtempSync(join(tmpdir(), "zeno-novo-"));
  mkdirSync(join(casa, ".config", "zeno"), { recursive: true }); writeFileSync(join(casa, ".config", "zeno", "bia.key"), "fixture\n");
  const r2 = await run(["install", dir, "--sem-sync"], { ...ctx, cwd: dir, home: casa, git: (a) => ({ status: 0, stdout: a[1] === "user.name" ? "Bia Souza\n" : "bia@x\n" }) });
  assert.match(r2.stdout, /chave_pub de bia vazia: .*zeno chave pub/);
  assert.match(readFileSync(join(dir, ".agents", "sistema.yaml"), "utf8"), /chave_pub: null/);
  // (2) o .gitignore do repo já cobre: nada vai ao info/exclude, e o sync --check não acusa
  const A = await criarAlvo({ git: true, antes: (d) => { mkdirSync(join(d, ".claude")); writeFileSync(join(d, ".claude", "settings.json"), "{}\n"); writeFileSync(join(d, ".gitignore"), ".claude/settings.local.json\n"); } }).pronto;
  const s = await A.z(["sync"], "agente", comPath);
  assert.equal(s.codigo, 0, s.stdout);
  assert.ok(!(existsSync(join(A.dir, ".git", "info", "exclude")) && readFileSync(join(A.dir, ".git", "info", "exclude"), "utf8").includes("settings.local.json")));
  assert.equal((await A.z(["sync", "--check"], "agente", comPath)).codigo, 0);
});
