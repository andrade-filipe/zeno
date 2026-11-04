// T117: a origem sensor:<nome> e a trava dos nós de sensor (1 por sensor e 5 por semana ISO, no alvo).
import { test } from "node:test";
import assert from "node:assert/strict";
import { alvo } from "./ajuda.mjs";
import { semanaIso } from "../core/util.mjs";

const SEG = Date.parse("2026-11-02T09:00:00Z"), DOM = Date.parse("2026-11-08T23:00:00Z"), SEG2 = Date.parse("2026-11-09T00:30:00Z");
const sensor = (A, nome, titulo = `Alarme ${nome}`) => A.z(["novo", titulo, "--tamanho", "P", "--porque", "o placar passou do teto", "--origem", `sensor:${nome}`]);

test("novo --origem sensor:retro é aceito; o 2º do mesmo sensor na semana sai 1; o 6º nó de sensor da semana sai 1", async () => {
  const A = await alvo();
  A.relogio(SEG);
  const r = await sensor(A, "retro");
  assert.equal(r.codigo, 0, r.stdout);
  const cri = A.ledger().find((e) => e.ev === "no.criado" && e.no === r.j.dados.id);
  assert.equal(cri.dados.sensor, "retro");
  assert.ok(cri.dados.origem_classes.includes("sensor"));
  assert.match(A.no(r.j.dados.id), /sensor:retro/);
  // o 2º do mesmo sensor, na mesma semana ISO (domingo ainda é a mesma)
  A.relogio(DOM);
  const dois = await sensor(A, "retro", "Outro alarme retro");
  assert.equal(dois.codigo, 1);
  assert.equal(dois.j.erros[0].regra, "sensor");
  assert.match(dois.j.erros[0].msg, /um por sensor por semana/);
  // mais 4 sensores: 5 na semana; o 6º (sensor novo) sai 1
  for (const s of ["atos", "imposto", "gasto", "custo"]) assert.equal((await sensor(A, s)).codigo, 0, s);
  const seis = await sensor(A, "sexto");
  assert.equal(seis.codigo, 1);
  assert.equal(seis.j.erros[0].regra, "sensor");
  assert.match(seis.j.erros[0].msg, /5 nós de sensor/);
  assert.equal(A.ledger().filter((e) => e.ev === "no.criado" && e.dados.sensor).length, 5, "nada gravado nas recusas");
  // a semana vira na segunda (UTC): o mesmo sensor abre de novo
  A.relogio(SEG2);
  assert.equal((await sensor(A, "retro", "Alarme retro da semana 46")).codigo, 0);
  // nó sem sensor não conta nem é barrado
  assert.equal((await A.z(["novo", "Trabalho comum", "--porque", "x", "--tamanho", "P"])).codigo, 0);
});

test("sensor: nome fora do formato e duas origens sensor saem 2 (uso)", async () => {
  const A = await alvo();
  for (const r of [await sensor(A, "Retro Alto"), await sensor(A, ""), await A.z(["novo", "Dois", "--tamanho", "P", "--porque", "x", "--origem", "sensor:a", "--origem", "sensor:b"])]) {
    assert.equal(r.codigo, 2); assert.match(r.j.erros[0].msg, /sensor/);
  }
});

test("semanaIso: segunda abre a semana; a 1ª semana do ano é a da 1ª quinta", () => {
  assert.equal(semanaIso(SEG), "2026-W45");
  assert.equal(semanaIso(DOM), "2026-W45");
  assert.equal(semanaIso(SEG2), "2026-W46");
  assert.equal(semanaIso(Date.parse("2027-01-01T12:00:00Z")), "2026-W53");
  assert.equal(semanaIso(Date.parse("2026-01-01T12:00:00Z")), "2026-W01");
  assert.equal(semanaIso(Date.parse("2024-12-30T12:00:00Z")), "2025-W01");
});
