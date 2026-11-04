// probe pessoas-hash (T73, D35): num alvo de fronteira cliente, nenhum nome nem e-mail de pessoa em claro no que é
// commitado (ledger, fio, vista do nó, sistema.yaml) — com nó criado com --dono pelo nome, mensagem --para pelo nome e
// gate humano assinado. A CLI continua entendendo o nome e a assinatura confere.
import { test } from "node:test"; import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs"; import { join } from "node:path";
import { alvo, noM, ESPEC_M } from "../ajuda.mjs";
import { caminhoSal } from "../../core/pessoas.mjs";
test("probe pessoas-hash", async () => {
  const A = await alvo({ fronteira: "cliente" });
  const id = await noM(A, "Tarefa do cliente", ["--dono", "ana", "--revisor", "ana"]);
  assert.equal((await A.z(["msg", id, "aviso", "--para", "ana", "--o-que", "teste de aviso para a pessoa"])).codigo, 0);
  assert.equal((await A.z(["avancar", id, "--ate", "execucao", ...ESPEC_M])).codigo, 3, "gate humano aberto");
  const g = await A.z(["gate", id, "--aprovar"], "pessoa");
  assert.equal(g.codigo, 0, g.stdout + g.stderr);
  // a CLI entende o nome: a caixa de ana e o estado depois do gate
  assert.equal((await A.z(["status", id])).j.dados.fase, "execucao");
  const disco = [readFileSync(A.caminho(".agents", "ledger.jsonl"), "utf8"), readFileSync(A.caminho(".agents", "sistema.yaml"), "utf8"),
    ...readdirSync(A.caminho(".agents", "trabalho")).map((f) => readFileSync(join(A.dir, ".agents", "trabalho", f), "utf8"))].join("\n");
  assert.ok(!/\bana\b/.test(disco), "nome de pessoa em claro no disco do alvo cliente");
  assert.ok(!disco.includes("ana@teste"), "e-mail em claro no disco do alvo cliente");
  assert.match(disco, /h:[0-9a-f]{8}/);
  // fail-closed: sem o sal, nenhum verbo escreve
  const semSal = await A.z(["novo", "Outra", "--expressa", "--porque", "x"], "agente", { home: A.dir + "-sem-home" });
  assert.equal(semSal.codigo, 1); assert.equal(semSal.j.erros[0].regra, "pessoas-hash");
  assert.ok(caminhoSal(A.home, "x").includes(".config/zeno/sal/"));
});
