// portão de publicação (T118): zeno promover --publicar <clone> monta o snapshot, roda os 6 checks e, com todos
// verdes, faz o commit e a tag no clone (sem push) e grava publicacao.preparada assinado. A cópia que guarda não muda.
import { test } from "node:test"; import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { montarPortao, reprovouSo } from "./portao-ajuda.mjs";
import { gitReal, gitFalso } from "./ajuda.mjs";
import { valida } from "../core/assinatura.mjs";
import { parseYaml } from "../core/yaml.mjs";
import { negarShell } from "../core/shell.mjs";
import { VERSAO } from "../core/run.mjs";

test("portão: os 6 checks verdes; o snapshot entra no clone com commit e tag, sem push; o evento é assinado", async () => {
  const P = await montarPortao();
  const r = await P.publicar();
  assert.equal(r.codigo, 0, r.stdout + r.stderr);
  for (const id of ["nomes", "casa", "gitleaks", "lista", "historico", "root"]) assert.match(r.stderr, new RegExp(`ok +${id}`));
  for (const f of ["cli.mjs", "core/run.mjs", "LICENSE", "NOTICE", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md", "docs/comecar.md", "docs/como-fazer/aprovar-um-gate.md"])
    assert.ok(existsSync(join(P.pub, f)), `entra ${f}`);
  for (const f of [".agents", ".claude", "CLAUDE.md", "_lixo", ".githooks"]) assert.ok(!existsSync(join(P.pub, f)), `fica fora ${f}`);
  // a 1ª publicação: o CHANGELOG é só o resumo da versão, sem nenhum assunto de commit (o histórico de fixture tem dois)
  const cl = P.ler("CHANGELOG.md");
  assert.match(cl, new RegExp(`## v${VERSAO.replace(/\./g, "\\.")} \\(\\d{4}-\\d\\d-\\d\\d\\)\\n\\nPrimeira versão pública do Zeno\\.`));
  assert.ok(!/portão de publicação|um conserto|abc1234|def5678|### /.test(cl), cl);
  // os links: para o lugar novo no snapshot; para fora do que entra, viram texto
  assert.match(P.ler("README.md"), /\[comece\]\(docs\/comecar\.md\) · o placar · \[a spec\]\(spec\/cli\.md#verbos\)/);
  assert.match(P.ler("spec/cli.md"), /\[glossário\]\(\.\.\/docs\/glossario\.md\)/);
  assert.match(P.ler("docs/como-fazer/aprovar-um-gate.md"), /\[a CLI\]\(\.\.\/\.\.\/spec\/cli\.md\) · o hub/);
  const g = (a) => gitReal(a, { cwd: P.pub }).stdout.trim();
  assert.equal(g(["status", "--porcelain"]), "", "commitado");
  assert.equal(g(["tag", "--list"]), `v${VERSAO}`);
  assert.equal(g(["remote"]), "", "nada foi enviado: o clone de teste nem tem remoto");
  assert.ok(!existsSync(join(P.A.home, ".local", "share", "zeno", "atual")), "a cópia que guarda não muda");
  const e = P.A.ledger().find((x) => x.ev === "publicacao.preparada");
  assert.equal(e.dados.commit, g(["rev-parse", "HEAD"]));
  assert.equal(e.dados.tag, `v${VERSAO}`);
  assert.deepEqual(e.dados.checks, { nomes: "ok", casa: "ok", gitleaks: "ok", lista: "ok", historico: "ok", root: "ok" });
  assert.ok(valida(e, parseYaml(P.A.ler(".agents/sistema.yaml")).obj.pessoas), "assinado pela pessoa");
  // de novo, com o commit do portão no clone: o histórico passa, mas a tag da versão já existe
  const antes = P.digital();
  reprovouSo(assert, await P.publicar(), "historico", antes, P);
});

test("portão: da 2ª publicação em diante, o CHANGELOG lista só os assuntos desde a origem da anterior", async () => {
  const P = await montarPortao();
  assert.equal((await P.publicar()).codigo, 0);
  gitReal(["tag", "-d", `v${VERSAO}`], { cwd: P.pub }); // a fixture não sobe a versão: a tag sai para o 2º portão passar
  // um 2º commit de verdade no monorepo de fixture (o snapshot sai do commit); só o git log é fingido
  writeFileSync(join(P.src, "core", "novo.mjs"), "// novo\n");
  for (const a of [["add", "-A"], ["commit", "-q", "-m", "feat(zeno): uma coisa nova"]]) gitReal(a, { cwd: P.mono });
  const segundo = gitReal(["rev-parse", "HEAD"], { cwd: P.mono }).stdout.trim();
  const logs = [], log = gitFalso({ log: "fff0001\tfeat(zeno): uma coisa nova\n" });
  const git = (args, o) => (args[0] === "log" && !o.cwd.startsWith(P.pub) ? (logs.push(args), log(args, o)) : gitReal(args, o));
  const r = await P.publicar("pessoa", { git });
  assert.equal(r.codigo, 0, r.stdout + r.stderr);
  assert.ok(logs.some((a) => a.includes(`${P.commit}..${segundo}`)), "o intervalo começa na origem da publicação anterior");
  assert.ok(existsSync(join(P.pub, "core", "novo.mjs")), "o 2º snapshot é o 2º commit");
  const cl = P.ler("CHANGELOG.md");
  assert.match(cl, /### Novidades\n\n- feat\(zeno\): uma coisa nova \(fff0001\)/);
  assert.ok(!/Primeira versão pública/.test(cl));
});

test("portão (pronto 5): o agente não publica; --publicar é verbo de pessoa e entrega.publicar é da faixa nunca", async () => {
  const P = await montarPortao();
  const antes = P.digital();
  const r = await P.publicar("agente");
  assert.equal(r.codigo, 3, r.stdout + r.stderr);
  assert.equal(r.j.erros[0].regra, "pessoa");
  assert.equal(P.digital(), antes, "o clone não muda");
  assert.ok(!P.A.ledger().some((x) => x.ev === "publicacao.preparada"));
  assert.ok(negarShell(`zeno promover --publicar ${P.pub}`), "o shell do agente nega o verbo de pessoa");
  assert.match(P.A.ler(".agents/faixas.yaml") + "", /entrega\.publicar:\s*\n\s*faixa: nunca/);
  const n = await P.A.z(["novo", "Publicar a v0.1", "--tamanho", "M", "--acao", "entrega.publicar", "--porque", "x"]);
  assert.equal(n.codigo, 1, "nó de publicação com executor agente é recusado");
});

test("portão: --publicar sem o diretório é erro de uso; árvore suja no zeno/ recusa antes da passphrase", async () => {
  const P = await montarPortao();
  assert.equal((await P.A.z(["promover", "--de", P.src, "--publicar"], "pessoa", P.ctx)).codigo, 2);
  const s = P.A.segredos;
  const sujo = (args, o) => (args[0] === "status" && args.includes("--untracked-files=all") && !o.cwd.startsWith(P.pub) ? { status: 0, stdout: "?? notas.txt\n" } : P.ctx.git(args, o));
  const r = await P.publicar("pessoa", { git: sujo });
  assert.equal(r.codigo, 1);
  assert.match(r.j.erros[0].msg, /não commitada no zeno/);
  assert.equal(P.A.segredos, s, "nem pediu a passphrase");
});
