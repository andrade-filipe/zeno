// a deriva da frota depois do promover (T106), só com alvos de fixture num registro de teste (HOME temporário).
// O promover confere cada alvo com a cópia nova, lista a deriva (segurança primeiro), pede uma confirmação e roda o sync
// só nos pessoais; nunca escreve em empresa ou cliente; o sync não faz commit; nada aqui derruba a promoção.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, renameSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { gitReal, rodarOk, raizTmp } from "./ajuda.mjs";
import { montarFrota, digital, head, check } from "./frota-ajuda.mjs";
import { run } from "../core/run.mjs";
import { ZENO_DIR } from "../core/config.mjs";
import { tipoDaDeriva } from "../core/verbos/instalar.mjs";

test("sync --check diz o tipo de cada deriva, a de segurança primeiro, e segue saindo 1", async () => {
  for (const [rel, t] of [[".claude/settings.json", "seguranca"], [".claude/settings.local.json", "seguranca"], [".agents/githooks/pre-commit", "seguranca"],
    [".git/config core.hooksPath", "seguranca"], [".git/info/exclude", "seguranca"], [".mcp.json", "seguranca"],
    ["AGENTS.md", "forma"], ["CLAUDE.md", "forma"], [".claude/skills/zeno-zeno/SKILL.md", "forma"], [".agents/gerados.lock", "forma"]]) assert.equal(tipoDaDeriva(rel), t, rel);
  const F = await montarFrota();
  const r = await check(F.A, F.a);
  assert.equal(r.codigo, 1);
  const j = JSON.parse(r.stdout);
  assert.ok(j.erros.every((e) => e.regra === "deriva" && ["seguranca", "forma"].includes(e.tipo)));
  const tipos = j.erros.map((e) => e.tipo);
  assert.ok(tipos.indexOf("forma") === -1 || tipos.lastIndexOf("seguranca") < tipos.indexOf("forma"), "segurança antes de forma");
  const t = (await run(["sync", "--check"], { ...F.A.ctx("agente"), cwd: F.a })).stdout;
  assert.match(t, /^deriva de segurança em: .*\.claude\/settings\.json/m);
  const f = await check(F.A, F.forma);
  assert.equal(f.codigo, 1); assert.deepEqual(JSON.parse(f.stdout).erros.map((e) => [e.arquivo, e.tipo]), [["CLAUDE.md", "forma"]]);
  assert.equal((await check(F.A, F.limpo)).codigo, 0);
});

test("promover sem confirmação: lista a deriva (segurança primeiro, cliente e empresa à mão) e nenhum alvo muda", async () => {
  const F = await montarFrota();
  const todos = [F.a, F.limpo, F.forma, F.cliente, F.empresa], antes = todos.map(digital);
  const r = await F.promover("");
  assert.equal(r.codigo, 0, r.stdout + r.stderr);
  const txt = r.stdout + r.stderr;
  assert.match(txt, /frota: 5 alvo\(s\) no registro; 4 com deriva/);
  assert.ok(txt.indexOf(F.a) < txt.indexOf(F.forma), "a deriva de segurança vem antes da de forma");
  assert.ok(!txt.includes(`${F.limpo}  (`), "o alvo sem deriva não aparece na lista");
  assert.match(txt, new RegExp(`cd '${F.cliente}' && zeno sync`)); assert.match(txt, new RegExp(`cd '${F.empresa}' && zeno sync`));
  assert.match(txt, /sync não rodou \(sem confirmação\)/);
  assert.deepEqual(todos.map(digital), antes.map((h, i) => (todos[i] === F.a ? digital(F.a) : h)), "fora o ledger do próprio A, nada muda");
  for (const d of [F.limpo, F.forma, F.cliente, F.empresa]) assert.equal(digital(d), antes[todos.indexOf(d)], d);
  const fr = r.j.dados.frota.alvos;
  assert.equal(fr.find((x) => x.caminho === F.cliente).opera, false);
  assert.ok(fr.every((x) => x.sync === null));
});

test("promover com confirmação: só os pessoais ficam sem deriva, sem commit; cliente e empresa intactos", async () => {
  const F = await montarFrota();
  const heads = [F.a, F.limpo, F.forma, F.cliente, F.empresa].map(head);
  const cli = digital(F.cliente), emp = digital(F.empresa);
  const r = await F.promover("s");
  assert.equal(r.codigo, 0, r.stdout + r.stderr);
  for (const d of [F.a, F.forma, F.limpo]) assert.equal((await check(F.A, d)).codigo, 0, `pessoal sem deriva: ${d}`);
  assert.equal((await check(F.A, F.cliente)).codigo, 1); assert.equal((await check(F.A, F.empresa)).codigo, 1);
  assert.equal(digital(F.cliente), cli); assert.equal(digital(F.empresa), emp);
  assert.deepEqual([F.a, F.limpo, F.forma, F.cliente, F.empresa].map(head), heads, "nenhum alvo ganhou commit");
  const txt = r.stdout + r.stderr;
  assert.match(txt, new RegExp(`sync ok: ${F.forma}`));
  assert.match(txt, new RegExp(`commit dos gerados: git -C '${F.forma}' add -- 'CLAUDE.md'`));
  assert.ok(r.j.dados.frota.alvos.filter((x) => x.sync === "ok").map((x) => x.caminho).sort().join() === [F.a, F.forma].sort().join());
});

test("worktree ligado é pulado; alvo quebrado vira linha; sem registro ou com registro ilegível, a promoção conclui", async () => {
  const F = await montarFrota();
  const wt = join(mkdtempSync(join(raizTmp(), "zeno-wt-")), "wt");
  assert.equal(gitReal(["worktree", "add", "-q", "-b", "w", wt], { cwd: F.limpo }).status, 0);
  const lista = join(F.A.home, ".local", "share", "zeno", "alvos.json");
  const j = JSON.parse(readFileSync(lista, "utf8"));
  j.alvos.push({ caminho: realpathSync(wt), nome: "wt", registrado: null });
  writeFileSync(lista, JSON.stringify(j));
  // um alvo cujo check não roda (fixa outra versão do módulo) vira linha; um sistema.yaml ilegível vale cliente (fail-closed)
  const sisF = join(F.forma, ".agents", "sistema.yaml"), sisL = join(F.limpo, ".agents", "sistema.yaml");
  writeFileSync(sisF, readFileSync(sisF, "utf8").replace(/nucleo: \S+/, "nucleo: 9.9.9"));
  const limpoAntes = digital(F.limpo);
  writeFileSync(sisL, "zeno: 1\nisto: [não fecha\n");
  const r = await F.promover("s");
  assert.equal(r.codigo, 0, r.stdout + r.stderr);
  const txt = r.stdout + r.stderr;
  assert.match(txt, new RegExp(`pulado ${realpathSync(wt)}: worktree ligado`));
  assert.match(txt, new RegExp(`não conferi ${F.forma}: versao`));
  const l = r.j.dados.frota.alvos.find((x) => x.caminho === F.limpo);
  assert.equal(l.fronteira, "cliente"); assert.equal(l.opera, false); assert.equal(l.sync, null);
  assert.notEqual(limpoAntes, digital(F.limpo)); // só o sistema.yaml que o teste quebrou
  renameSync(lista, lista + ".fora");
  const v = await F.promover("");
  assert.equal(v.codigo, 0); assert.deepEqual(v.j.dados.frota, { alvos: [] });
  assert.match((await F.A.cru(["promover", "--de", ZENO_DIR], "pessoa", { git: F.git, which: () => true, rodar: rodarOk })).stdout, /registro de alvos está vazio/);
  writeFileSync(lista, "{ quebrado");
  const q = await F.promover("");
  assert.equal(q.codigo, 0); assert.match(q.j.dados.frota.erro, /ilegível/);
});
