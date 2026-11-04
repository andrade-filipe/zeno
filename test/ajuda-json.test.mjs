// T91: zeno ajuda --json dá os verbos, quem pode rodar cada um e os códigos de saída como dado, sem drift do despacho.
import { test } from "node:test"; import assert from "node:assert/strict";
import { alvo } from "./ajuda.mjs";
import { NOMES_DOS_VERBOS, CATALOGO } from "../core/run.mjs";
import { PESSOA, negarShell } from "../core/shell.mjs";

test("ajuda --json: verbos, pessoa e códigos, iguais ao despacho e ao texto", async () => {
  const A = await alvo();
  const r = await A.z(["ajuda"]);
  assert.equal(r.codigo, 0);
  const { verbos, codigos, versao } = r.j.dados;
  assert.match(versao, /^\d+\.\d+\.\d+$/);
  const base = new Set(verbos.map((v) => v.verbo.split(" ")[0]));
  assert.deepEqual([...base].sort(), [...NOMES_DOS_VERBOS].sort(), "todo verbo do despacho está no catálogo, e só eles");
  for (const v of verbos) {
    assert.equal(typeof v.pessoa, "boolean", `${v.verbo}: pessoa é true/false`);
    assert.equal(typeof v.muda, "boolean", `${v.verbo}: muda é true/false`);
    assert.ok(v.uso && v.faz, `${v.verbo}: uso e faz`);
  }
  const texto = (await A.cru(["ajuda"])).stdout;
  for (const v of verbos) assert.ok(texto.includes(v.verbo.split(" ")[0]), `o texto da ajuda cita ${v.verbo}`);
  assert.deepEqual(verbos.filter((v) => v.pessoa).map((v) => v.verbo).sort(), ["caixa --aprovar", "chave", "gate", "promover"]);
  for (const v of ["gate", "caixa --aprovar", "chave nova", "promover"]) assert.match(texto, new RegExp(`${v.replace(/-/g, "\\-")}[^·\\n]*\\(pessoa`), `o texto marca ${v} como de pessoa`);
  assert.deepEqual(codigos.map((c) => c.codigo), [0, 1, 2, 3, 4, 5, 6, 9]);
  assert.match(texto, /Códigos: 0 ok · 1 regra · 2 uso · 3 pessoa · 4 orçamento · 5 trava · 6 não implementado · 9 bug/);
  // os de pessoa recusam agente com 3 (o mesmo código que o catálogo promete)
  assert.equal((await A.z(["chave", "nova"], "agente")).codigo, 3);
  assert.equal((await A.z(["caixa", "--aprovar"], "agente")).codigo, 3);
});

// T92: o que a camada 2 nega ao agente no shell é, no catálogo, de pessoa ou só do hook, e vice-versa.
test("ajuda --json: o PESSOA do shell bate com o catálogo (pessoa ou quem: hook)", () => {
  const fechado = (v) => v.pessoa || v.quem === "hook";
  const doCatalogo = CATALOGO.filter(fechado).map((v) => v.verbo).sort();
  const doShell = [...PESSOA, "caixa --aprovar"].sort();
  assert.deepEqual(doCatalogo, doShell, "o shell nega ao agente exatamente os verbos que o catálogo fecha");
  assert.deepEqual(CATALOGO.filter((v) => v.quem).map((v) => [v.verbo, v.quem, v.pessoa]), [["guarda", "hook", false]]);
  for (const v of doCatalogo) assert.equal(negarShell(`zeno ${v}`), "pessoa", `o shell nega zeno ${v} ao agente`);
  for (const v of CATALOGO.filter((x) => !fechado(x))) assert.notEqual(negarShell(`zeno ${v.verbo}`), "pessoa", `o shell deixa zeno ${v.verbo}`);
});
