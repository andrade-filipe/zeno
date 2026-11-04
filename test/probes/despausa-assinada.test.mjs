// probe despausa-assinada: o nó pausado pelo disjuntor só sai da pausa por evento assinado de pessoa. O agente que baixa
// o orçamento (zeno ajustar, que não afrouxa e não pede assinatura) segue pausado.
// Reproduzia o furo achado pela sessão de docs em 2026-11-03 (o orcamento.alterado sem assinatura despausava); T98 fecha.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo, noP } from "../ajuda.mjs";
test("probe despausa-assinada", async () => {
  const A = await alvo();
  const id = await noP(A, "Teto", ["--orcamento", "tokens=10"]);
  assert.equal((await A.z(["registrar", "gasto", id, "--tokens", "11"])).codigo, 4, "o disjuntor pausa");
  assert.equal((await A.z(["status", id])).j.dados.estado, "pausado");
  const b = await A.z(["ajustar", id, "orcamento=tokens=5"]);
  assert.equal(b.codigo, 0, "baixar o orçamento segue livre");
  assert.equal((await A.z(["status", id])).j.dados.estado, "pausado", "baixar o orçamento não tira o nó da pausa");
  assert.equal((await A.z(["avancar", id, "--pronto", "p"])).codigo, 4, "e o avanço segue barrado");
  // a pessoa solta subindo o orçamento (assinado)
  assert.equal((await A.z(["gate", id, "--orcamento", "tokens=+20"], "pessoa")).codigo, 0);
  assert.equal((await A.z(["status", id])).j.dados.estado, "ativo", "o aumento assinado despausa");
});

test("gate --despausar (T98): só pessoa, com motivo, só em nó pausado; solta sem subir o teto", async () => {
  const A = await alvo();
  const id = await noP(A, "Solta", ["--orcamento", "tokens=10"]);
  assert.equal((await A.z(["gate", id, "--despausar", "--motivo", "x"], "pessoa")).codigo, 1, "não está pausado");
  assert.equal((await A.z(["registrar", "gasto", id, "--tokens", "11"])).codigo, 4);
  assert.equal((await A.z(["gate", id, "--despausar", "--motivo", "x"])).codigo, 3, "agente não solta");
  assert.equal((await A.z(["gate", id, "--despausar"], "pessoa")).codigo, 2, "pede --motivo");
  const r = await A.z(["gate", id, "--despausar", "--motivo", "o gasto foi erro de medida"], "pessoa");
  assert.equal(r.codigo, 0, JSON.stringify(r.j?.erros));
  const st = (await A.z(["status", id])).j.dados;
  assert.equal(st.estado, "ativo");
  assert.deepEqual(st.orcamento, { tokens: 10 }, "o teto não sobe");
  const e = A.ledger().find((x) => x.ev === "disjuntor.liberado");
  assert.ok(e?.assinatura, "evento assinado");
});
