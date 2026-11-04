// contrato do ledger: acréscimos da Etapa 2 pedidos pela avaliacao/ (T70), sem quebrar a v1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { alvo, noP, noM, ESPEC_M } from "./ajuda.mjs";
import { idsCitados } from "../core/shell.mjs";
import { sha256 } from "../core/util.mjs";
import { readFileSync, writeFileSync } from "node:fs";

test("B2: recusa da guarda leva o nó citado e o sessao_sha256", async () => {
  const A = await alvo();
  const id = await noP(A);
  const hook = (command) => A.cru(["guarda", "pre-tool"], "agente", { entrada: async () => JSON.stringify({ cwd: A.dir, session_id: "s-42", tool_name: "Bash", tool_input: { command } }) });
  await hook(`zeno gate ${id} --aprovar`);
  await hook("echo x > .agents/ledger.jsonl");
  const [r1, r2] = A.ledger().filter((e) => e.ev === "recusa" && e.dados.verbo === "guarda");
  assert.equal(r1.no, id);
  assert.equal(r1.dados.sessao_sha256, sha256("s-42"));
  assert.equal(r2.no, null, "sem nó citado, sem nó");
  assert.equal(r2.dados.sessao_sha256, sha256("s-42"));
  assert.deepEqual(idsCitados(`cd x && zeno avancar a1 --ate fim; node ./cli.mjs registrar gasto b2 --tokens 1; zeno caixa --aprovar; echo "zeno gate c3"`), ["a1", "b2"]);
});

test("B3: atrito_padrao só quando a CLI preencheu o 'nenhum'", async () => {
  const A = await alvo();
  const a = await noP(A, "Auto"), b = await noP(A, "Escrito");
  const fim = ["--ate", "fim", "--pronto", "p", "--feito", "f", "--evidencia", "e", "--ref", "r", "--desfazer", "d"];
  assert.equal((await A.z(["avancar", a, ...fim])).codigo, 0);
  assert.equal((await A.z(["avancar", b, ...fim, "--atrito", "nenhum, conferido"])).codigo, 0);
  const sai = (id) => A.ledger().find((e) => e.no === id && e.ev === "fase.avancou" && e.dados.de === "aprendizado");
  assert.equal(sai(a).dados.atrito_padrao, true);
  assert.equal(sai(b).dados.atrito_padrao, undefined);
});

test("T110: gate.retirado guarda só o hash do motivo; o texto vai ao fio como aviso ao revisor; o formato antigo projeta", async () => {
  const A = await alvo();
  const id = await noM(A);
  assert.equal((await A.z(["avancar", id, "--ate", "fim", ...ESPEC_M])).codigo, 3);
  assert.equal((await A.z(["revisar", id, "--motivo", "  o hub contradiz a spec  "])).codigo, 0);
  const g = A.ledger().find((e) => e.ev === "gate.retirado");
  assert.equal(g.dados.motivo_sha256, sha256("o hub contradiz a spec"));
  assert.ok(!("motivo" in g.dados), "sem o texto do motivo no ledger");
  const revisor = A.ledger().find((e) => e.ev === "no.criado" && e.no === id).dados.revisor;
  assert.ok(A.fio(id).includes(`### m-${g.id} · aviso · `) && A.fio(id).includes(`→ ${revisor}\n`), A.fio(id));
  assert.match(A.fio(id), /- \*\*o-que:\*\* gate especificacao retirado da caixa: o hub contradiz a spec/);
  // os 2 eventos antigos do zeno/ têm o motivo em claro: seguem projetando sem erro (append-only, nada se reescreve)
  const p = A.caminho(".agents", "ledger.jsonl");
  writeFileSync(p, readFileSync(p, "utf8").replace(`"motivo_sha256":"${g.dados.motivo_sha256}"`, '"motivo":"x"'));
  assert.equal(A.ledger().find((e) => e.ev === "gate.retirado").dados.motivo, "x");
  assert.equal((await A.z(["validar"])).codigo, 0);
  assert.equal((await A.z(["avancar", id])).codigo, 3, "o avancar reabre o gate");
});

test("B5: install.executado leva a fronteira", async () => {
  const A = await alvo();
  assert.equal(A.ledger().find((e) => e.ev === "install.executado").dados.fronteira, "pessoal");
});
