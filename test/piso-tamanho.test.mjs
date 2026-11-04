// T115: subir o tamanho sobe a faixa declarada até o piso do tamanho novo, no mesmo ajustar; nunca baixa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { alvo, ESPEC_M } from "./ajuda.mjs";

const novoP = async (A, extra = []) => {
  const r = await A.z(["novo", "Começou pequeno", "--tamanho", "P", "--porque", "teste", ...extra]);
  assert.equal(r.codigo, 0, r.stdout);
  return r.j.dados.id;
};
const doNo = (A, id) => A.ledger().filter((e) => e.no === id);

test("o agente ajusta P autônomo para M: a faixa vai a aprovacao, com motivo tamanho, e o gate de Especificação é de pessoa", async () => {
  const A = await alvo();
  const id = await novoP(A);
  assert.match(A.no(id), /^faixa: autonoma$/m);
  const r = await A.z(["ajustar", id, "tamanho=M"]);
  assert.equal(r.codigo, 0, r.stdout);
  assert.match(A.no(id), /^tamanho: M$/m);
  assert.match(A.no(id), /^faixa: aprovacao$/m);
  const evs = doNo(A, id);
  const aj = evs.filter((e) => e.ev === "ajuste");
  assert.deepEqual(aj.map((e) => [e.dados.campo, e.dados.antes, e.dados.depois, e.dados.motivo ?? null, e.dados.afrouxa]),
    [["tamanho", "P", "M", null, false], ["faixa", "autonoma", "aprovacao", "tamanho", false]], "o mesmo comando grava os dois ajustes");
  assert.equal(new Set(aj.map((e) => e.cmd)).size, 1);
  const fa = evs.filter((e) => e.ev === "faixa.alterada").at(-1);
  assert.deepEqual([fa.dados.de, fa.dados.para, fa.dados.motivo], ["autonoma", "aprovacao", "tamanho"]);
  // o próximo gate é humano: a Especificação de M em aprovacao para em 3
  const g = await A.z(["avancar", id, "--ate", "execucao", "--para", "o time", "--fora", "nada", ...ESPEC_M]);
  assert.equal(g.codigo, 3, g.stdout);
  assert.match(A.no(id), /^estado: em-gate$/m);
});

test("o agente que declara a faixa abaixo do piso no mesmo ajuste também sobe ao piso; P para G vai ao piso de G", async () => {
  const A = await alvo();
  const id = await novoP(A);
  assert.equal((await A.z(["ajustar", id, "tamanho=M", "faixa=autonoma"])).codigo, 0);
  assert.match(A.no(id), /^faixa: aprovacao$/m);
  assert.equal(doNo(A, id).filter((e) => e.ev === "ajuste" && e.dados.campo === "faixa").at(-1).dados.motivo, "tamanho");
  const g = await novoP(A);
  assert.equal((await A.z(["ajustar", g, "tamanho=G"])).codigo, 0);
  assert.match(A.no(g), /^faixa: aprovacao$/m);
});

test("com a faixa já no piso ou acima nada muda; baixar o tamanho nunca baixa a faixa", async () => {
  const A = await alvo();
  // já no piso: P declarado em aprovacao, ajustado para M
  const id = await novoP(A, ["--faixa", "aprovacao"]);
  const antes = doNo(A, id).length;
  assert.equal((await A.z(["ajustar", id, "tamanho=M"])).codigo, 0);
  const novos = doNo(A, id).slice(antes);
  assert.deepEqual(novos.map((e) => [e.ev, e.dados.campo ?? null]), [["ajuste", "tamanho"]], "só o ajuste do tamanho");
  // M para G: o piso de G é aprovacao, igual; nada muda
  assert.equal((await A.z(["ajustar", id, "tamanho=G"])).codigo, 0);
  assert.ok(!doNo(A, id).some((e) => e.dados?.motivo === "tamanho"));
  // baixar o tamanho é afrouxar (de pessoa, assinado) e, mesmo assim, não baixa a faixa
  assert.equal((await A.z(["ajustar", id, "tamanho=P"])).codigo, 3);
  assert.equal((await A.z(["ajustar", id, "tamanho=P", "--motivo", "era pequeno"], "pessoa")).codigo, 0);
  assert.match(A.no(id), /^faixa: aprovacao$/m);
  // acima do piso: nunca segue nunca
  const n = await A.z(["novo", "Perigoso", "--tamanho", "P", "--porque", "teste", "--faixa", "nunca", "--executor", "ana"]);
  assert.equal(n.codigo, 0, n.stdout);
  assert.equal((await A.z(["ajustar", n.j.dados.id, "tamanho=M"])).codigo, 0);
  assert.match(A.no(n.j.dados.id), /^faixa: nunca$/m);
});
