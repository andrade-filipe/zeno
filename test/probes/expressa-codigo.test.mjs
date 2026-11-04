// probe expressa-codigo (T76, D36): P de código do zeno vai pela via expressa mesmo não confiável, mas só se o commit da
// ref fica no código (cli.mjs, core/, bin/, modulos/, test/*.test.mjs); spec/ ou a prova das guardas reprovam a Entrega.
import { test } from "node:test"; import assert from "node:assert/strict";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { alvo, gitReal } from "../ajuda.mjs";

const commitar = (A, arqs) => {
  for (const a of arqs) { mkdirSync(join(A.dir, a, ".."), { recursive: true }); A.escrever(a, `// ${a} ${Math.random()}\n`); }
  gitReal(["add", "--", ...arqs], { cwd: A.dir });
  gitReal(["commit", "-q", "-m", "x", "--", ...arqs], { cwd: A.dir });
  return gitReal(["rev-parse", "HEAD"], { cwd: A.dir }).stdout.trim();
};
const fim = (sha) => ["--ate", "fim", "--pronto", "o teste passa", "--feito", "mudei", "--evidencia", "node --test ok", "--ref", sha, "--desfazer", `git revert ${sha}`];

test("probe expressa-codigo", async () => {
  const A = await alvo({ git: true });
  const sem = await A.z(["novo", "Fora do zeno", "--expressa", "--codigo", "--porque", "teste"]);
  assert.equal(sem.codigo, 1, "--codigo só no alvo que é o código do zeno");
  commitar(A, ["cli.mjs", "core/run.mjs"]);
  const naoConf = ["--origem", "web:exemplo"];
  assert.equal((await A.z(["novo", "Sem codigo", "--expressa", "--porque", "teste", ...naoConf])).codigo, 1, "não confiável sem --codigo: sem via expressa");
  assert.equal((await A.z(["novo", "So codigo", "--codigo", "--tamanho", "P", "--porque", "teste"])).codigo, 2, "--codigo pede --expressa");
  assert.equal((await A.z(["novo", "Com acao", "--expressa", "--codigo", "--porque", "teste", "--acao", "entrega.push-main", ...naoConf])).codigo, 1, "o piso das ações continua");
  // P de código no core: fecha sem gate humano, e a cópia fixada não muda sem o promover
  const ok = (await A.z(["novo", "Conserto no core", "--expressa", "--codigo", "--porque", "teste", ...naoConf])).j.dados.id;
  const r = await A.z(["avancar", ok, ...fim(commitar(A, ["core/x.mjs", "test/x.test.mjs"]))]);
  assert.equal(r.codigo, 0, JSON.stringify(r.j));
  assert.equal(r.j.dados.estado, "fechado");
  assert.ok(!A.ledger().some((e) => e.no === ok && e.ev === "gate.aberto"));
  assert.ok(!existsSync(join(A.home, ".local", "share", "zeno", "atual")), "sem promover, nada chega na cópia fixada");
  // spec/ ou a prova das guardas no commit: a Entrega reprova
  for (const fora of [["core/y.mjs", "spec/x.md"], ["test/probes/x.test.mjs"], ["guardas.json"], ["test/ajuda.mjs"]]) {
    const id = (await A.z(["novo", `Toca ${fora.at(-1)}`, "--expressa", "--codigo", "--porque", "teste", ...naoConf])).j.dados.id;
    const r2 = await A.z(["avancar", id, ...fim(commitar(A, fora))]);
    assert.equal(r2.codigo, 1, `${fora.join(",")}: a via expressa não vale`);
    assert.equal(r2.j.dados.fase, "entrega");
    assert.equal(A.ledger().filter((e) => e.no === id && e.ev === "gate.decidido").at(-1).dados.decisao, "reprovado");
  }
  // T79: spec/decisoes-tecnicas.md entra só por acréscimo; remover uma linha dele reprova
  const dt = "spec/decisoes-tecnicas.md";
  const novoNo = async (t) => (await A.z(["novo", t, "--expressa", "--codigo", "--porque", "teste", ...naoConf])).j.dados.id;
  const add = await novoNo("Decisao por acrescimo");
  A.escrever("core/z.mjs", "// z\n"); A.escrever(dt, "# decisões\n- T1\n- T2\n");
  gitReal(["add", "--", "core/z.mjs", dt], { cwd: A.dir }); gitReal(["commit", "-q", "-m", "x", "--", "core/z.mjs", dt], { cwd: A.dir });
  const r3 = await A.z(["avancar", add, ...fim(gitReal(["rev-parse", "HEAD"], { cwd: A.dir }).stdout.trim())]);
  assert.equal(r3.codigo, 0, `acréscimo em ${dt} vale: ${JSON.stringify(r3.j)}`);
  const tira = await novoNo("Decisao removida");
  A.escrever(dt, "# decisões\n- T1\n- T3\n");
  gitReal(["commit", "-q", "-m", "x", "--", dt], { cwd: A.dir });
  const r4 = await A.z(["avancar", tira, ...fim(gitReal(["rev-parse", "HEAD"], { cwd: A.dir }).stdout.trim())]);
  assert.equal(r4.codigo, 1, `remover linha de ${dt} não vale pela via expressa`);
});
