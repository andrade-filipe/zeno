// registro de alvos da máquina (T104), sempre num HOME temporário: o install registra, zeno alvos mostra a fronteira
// efetiva (a mais restrita; sem nada, cliente), --descobrir e --esquecer mantêm a lista, e nada disso entra num repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, renameSync, symlinkSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { alvo, gitReal, raizTmp } from "./ajuda.mjs";
import { run } from "../core/run.mjs";
import { caminhosDoRegistro, registrarAlvo, vistaDosAlvos, maisRestrita } from "../core/alvos.mjs";

const lista = (A) => JSON.parse(readFileSync(join(A.home, ".local", "share", "zeno", "alvos.json"), "utf8")).alvos;
const regras = (A, txt) => { mkdirSync(join(A.home, ".local", "share", "zeno"), { recursive: true }); writeFileSync(join(A.home, ".local", "share", "zeno", "regras.yaml"), txt); };
const fronteiraNoSistema = (A, f) => A.escrever(".agents/sistema.yaml", A.ler(".agents/sistema.yaml").replace(/^fronteira: .*\n/m, f ? `fronteira: ${f}\n` : ""));
// um alvo a mais no mesmo HOME (o install com o ctx do primeiro)
async function outroAlvo(A, pasta, extra = []) {
  mkdirSync(pasta, { recursive: true });
  const r = await run(["install", pasta, "--sem-sync", "--pessoa", "ana", ...extra, "--json"], A.ctx("agente"));
  assert.equal(r.codigo, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout);
}
function arquivosSob(d) {
  const out = [];
  for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory() && !e.isSymbolicLink()) out.push(...arquivosSob(p)); else out.push(e.name); }
  return out;
}

test("maisRestrita: cliente > empresa > pessoal; desconhecida não conta", () => {
  assert.equal(maisRestrita("pessoal", "cliente"), "cliente");
  assert.equal(maisRestrita("empresa", "pessoal"), "empresa");
  assert.equal(maisRestrita(null, "pessoal"), "pessoal");
  assert.equal(maisRestrita("qualquer", null), null);
});

test("o install registra o alvo na lista da máquina (fora do alvo), e registrar de novo não duplica", async () => {
  const A = await alvo();
  const real = realpathSync(A.dir);
  const c = caminhosDoRegistro(A.ctx("agente"));
  assert.equal(c.alvos, join(A.home, ".local", "share", "zeno", "alvos.json"));
  assert.deepEqual(lista(A).map((a) => a.caminho), [real]);
  assert.ok(lista(A)[0].registrado && lista(A)[0].nome);
  assert.equal(registrarAlvo(A.ctx("agente"), A.dir, "x").ok, true);
  assert.equal(lista(A).length, 1, "não duplica");
  // nada do registro mora dentro do alvo
  const nomes = arquivosSob(A.dir);
  assert.ok(!nomes.includes("alvos.json") && !nomes.includes("regras.yaml"), nomes.join(","));
});

test("zeno alvos --json: declarada, regra, efetiva, divergência e opera (o contrato da frota)", async () => {
  const A = await alvo();
  const r = await A.z(["alvos"]);
  assert.equal(r.codigo, 0, r.stderr);
  const [a] = r.j.dados.alvos;
  for (const k of ["caminho", "nome", "registrado", "declarada", "regra", "regras", "efetiva", "divergencia", "sumiu", "worktree", "opera"]) assert.ok(k in a, k);
  assert.equal(a.declarada, "pessoal"); assert.equal(a.regra, null); assert.equal(a.efetiva, "pessoal");
  assert.equal(a.divergencia, false); assert.equal(a.opera, true);
  assert.equal(r.j.dados.registro, join(A.home, ".local", "share", "zeno", "alvos.json"));
  assert.match((await A.cru(["alvos"])).stdout, /opera\s+pessoal/);
});

test("efetiva: a regra cliente vence o pessoal declarado; nenhuma regra afrouxa; sem nada vale cliente", async () => {
  const A = await alvo();
  const emp =join(mkdtempSync(join(raizTmp(), "zeno-emp-")), "repo"), semNada = join(mkdtempSync(join(raizTmp(), "zeno-sn-")), "repo");
  await outroAlvo(A, emp, ["--fronteira", "empresa"]);
  const sn = await outroAlvo(A, semNada);
  assert.ok(sn.avisos.some((x) => x.regra === "fronteira" && /sem --fronteira/.test(x.msg)), "install sem fronteira e sem regra avisa");
  regras(A, `zeno: 1\nregras:\n  "${A.dir}/**": cliente\n  "${A.dir}": cliente\n  "${emp}": pessoal\n`);
  fronteiraNoSistema({ ler: (p) => readFileSync(join(semNada, p), "utf8"), escrever: (p, t) => writeFileSync(join(semNada, p), t) }, null);
  const v = vistaDosAlvos(A.ctx("agente"));
  const de = (d) => v.alvos.find((x) => x.caminho === realpathSync(d));
  assert.equal(de(A.dir).efetiva, "cliente"); assert.equal(de(A.dir).divergencia, true); assert.equal(de(A.dir).opera, false);
  assert.equal(de(emp).efetiva, "empresa", "a regra pessoal não afrouxa o empresa declarado"); assert.equal(de(emp).opera, false);
  assert.equal(de(semNada).declarada, null); assert.equal(de(semNada).efetiva, "cliente", "sem fronteira e sem regra = cliente"); assert.equal(de(semNada).opera, false);
  assert.ok(v.avisos.some((x) => x.regra === "fronteira" && x.msg.includes(realpathSync(A.dir))));
});

test("o install avisa quando a regra por pasta é mais restrita que a fronteira gravada", async () => {
  const A = await alvo();
  const pai = mkdtempSync(join(raizTmp(), "zeno-cli-")), novo = join(pai, "repo");
  regras(A, `regras:\n  "${pai}/**": cliente\n`);
  const r = await outroAlvo(A, novo);
  assert.ok(r.avisos.some((x) => x.regra === "fronteira" && /regra por pasta diz cliente/.test(x.msg)), JSON.stringify(r.avisos));
  assert.match(readFileSync(join(novo, ".agents", "sistema.yaml"), "utf8"), /^fronteira: pessoal$/m, "o install não muda o que grava (a composição é do médio prazo)");
});

test("regras ilegíveis ou lista corrompida: a frota não opera nada (fail-closed) e o install segue com aviso", async () => {
  const A = await alvo();
  regras(A, "regras:\n  ~/sem/aspas/**: cliente\n");
  let v = vistaDosAlvos(A.ctx("agente"));
  assert.ok(v.erro && v.alvos.every((a) => !a.opera));
  regras(A, `regras:\n  "~/x/**": aberta\n`);
  assert.match(vistaDosAlvos(A.ctx("agente")).erro, /fronteira desconhecida/);
  regras(A, "zeno: 1\n");
  writeFileSync(join(A.home, ".local", "share", "zeno", "alvos.json"), "{ não é json");
  v = vistaDosAlvos(A.ctx("agente"));
  assert.match(v.erro, /ilegível/); assert.equal(v.alvos.length, 0);
  const r = await outroAlvo(A, join(mkdtempSync(join(raizTmp(), "zeno-x-")), "repo"));
  assert.equal(r.codigo, 0);
  assert.ok(r.avisos.some((x) => x.regra === "registro"), "o install avisa e segue");
  assert.equal((await A.z(["alvos", "--descobrir", A.dir])).codigo, 1, "descobrir não reescreve uma lista ilegível");
});

test("--descobrir: acha sob as pastas dadas, pula node_modules, oculta, link e worktree ligado; não lê fora", async () => {
  const A = await alvo();
  const base = mkdtempSync(join(raizTmp(), "zeno-desc-")), fora = mkdtempSync(join(raizTmp(), "zeno-fora-"));
  const mk = (d) => { mkdirSync(join(d, ".agents"), { recursive: true }); writeFileSync(join(d, ".agents", "sistema.yaml"), "zeno: 1\nalvo: x\nfronteira: pessoal\n"); return d; };
  const a = mk(join(base, "repos", "a")), b = mk(join(base, "repos", "grupo", "b"));
  mk(join(base, "x", "node_modules", "n")); mk(join(base, ".oculto", "o")); mk(join(base, "_lixo", "l"));
  const longe = mk(join(fora, "longe")); symlinkSync(longe, join(base, "atalho"));
  // um repo git com alvo e um worktree ligado dele, dentro da base
  const g = mk(join(base, "g"));
  gitReal(["init", "-q", "-b", "main"], { cwd: g }); gitReal(["add", "-A"], { cwd: g }); gitReal(["commit", "-qm", "x"], { cwd: g });
  assert.equal(gitReal(["worktree", "add", "-q", "-b", "wt", join(base, "wt")], { cwd: g }).status, 0);
  const r = await A.z(["alvos", "--descobrir", base, join(base, "nao-existe")]);
  assert.equal(r.codigo, 0, r.stderr);
  const R = (d) => realpathSync(d);
  assert.deepEqual([...r.j.dados.achados].sort(), [R(a), R(b), R(g)].sort());
  assert.ok(r.j.dados.pulados.some((p) => p.motivo === "worktree ligado"));
  assert.ok(r.j.dados.pulados.some((p) => p.motivo === "não existe"));
  assert.ok(!lista(A).some((x) => x.caminho === R(longe)), "não segue link para fora");
  const n = lista(A).length;
  assert.equal((await A.z(["alvos", "--descobrir", base])).j.dados.novos.length, 0, "rodar de novo não duplica");
  assert.equal(lista(A).length, n);
  assert.equal((await A.z(["alvos", "--descobrir"])).codigo, 2, "sem pasta é uso errado");
});

test("--esquecer tira da lista; o alvo cujo sistema.yaml sumiu aparece marcado e não opera", async () => {
  const A = await alvo();
  const outro = join(mkdtempSync(join(raizTmp(), "zeno-o-")), "repo");
  await outroAlvo(A, outro);
  renameSync(join(outro, ".agents"), join(outro, "agents-movido"));
  let v = vistaDosAlvos(A.ctx("agente"));
  const s = v.alvos.find((x) => x.caminho === realpathSync(outro));
  assert.equal(s.sumiu, true); assert.equal(s.opera, false);
  const r = await A.z(["alvos", "--esquecer", outro]);
  assert.equal(r.codigo, 0); assert.deepEqual(r.j.dados.tirados, [realpathSync(outro)]);
  v = vistaDosAlvos(A.ctx("agente"));
  assert.equal(v.alvos.length, 1);
  const n = await A.z(["alvos", "--esquecer", "/nao/estava"]);
  assert.equal(n.codigo, 0); assert.ok(n.j.avisos.some((x) => /nenhum destes/.test(x.msg)));
  assert.equal((await A.z(["alvos", "--esquecer", "--descobrir"])).codigo, 2);
});

test("worktree ligado não entra pelo install", async () => {
  const A = await alvo({ git: true });
  gitReal(["add", "-A"], { cwd: A.dir }); gitReal(["commit", "-qm", "alvo"], { cwd: A.dir });
  const wt = join(mkdtempSync(join(raizTmp(), "zeno-wt-")), "wt");
  assert.equal(gitReal(["worktree", "add", "-q", "-b", "w", wt], { cwd: A.dir }).status, 0);
  const r = registrarAlvo(A.ctx("agente"), wt, "w");
  assert.equal(r.ok, false); assert.match(r.msg, /worktree ligado/);
  assert.ok(!existsSync(join(wt, "alvos.json")));
});
