// probe caixa-revisao (T87): um nó em revisão não fica aprovável na caixa. (1) zeno revisar tira o gate da caixa e o
// próximo avancar o reabre; (2) gate cujo texto mudou depois de aberto fica fora do "todos" (só por número); (3) seção
// aprovada que mudou é erro no validar até o gate ser reaberto, e aviso enquanto ele espera a decisão.
import { test } from "node:test"; import assert from "node:assert/strict";
import { alvo, noM, ESPEC_M } from "../ajuda.mjs";

const mexer = (A, id) => A.escrever(`.agents/trabalho/${id}.md`, A.no(id).replace("## Especificação\n", "## Especificação\n\nem revisão: não aprove\n"));
const aprovou = (A, id, fase) => A.ledger().some((e) => e.no === id && e.ev === "gate.decidido" && e.dados.fase === fase && e.dados.decisao === "aprovado");

test("probe caixa-revisao", async () => {
  const A = await alvo();
  // (1) revisar: o gate sai da caixa; o "todos" não o aprova; o avancar o abre de novo
  const r1 = await noM(A, "Revisto");
  assert.equal((await A.z(["avancar", r1, "--ate", "fim", ...ESPEC_M])).codigo, 3);
  assert.equal((await A.z(["revisar", r1])).codigo, 2, "revisar pede --motivo");
  assert.equal((await A.z(["revisar", r1, "--motivo", "o hub contradiz a spec"])).codigo, 0);
  const c1 = await A.z(["caixa", "--aprovar"], "pessoa", { perguntar: async () => "todos" });
  assert.ok(!aprovou(A, r1, "especificacao"), `nó em revisão não pode ser aprovado pela caixa: ${c1.stdout}`);
  assert.equal((await A.z(["avancar", r1])).codigo, 3, "o avancar reabre o gate");
  // (2) texto mudou depois que o gate abriu: fora do "todos", aprovável por número
  const r2 = await noM(A, "Mudou depois");
  assert.equal((await A.z(["avancar", r2, "--ate", "fim", ...ESPEC_M])).codigo, 3);
  mexer(A, r2);
  await A.z(["caixa", "--aprovar"], "pessoa", { perguntar: async () => "todos" });
  assert.ok(aprovou(A, r1, "especificacao"), "o gate reaberto sem mudança entra no todos");
  assert.ok(!aprovou(A, r2, "especificacao"), "gate com texto mudado fica fora do todos");
  await A.z(["caixa", "--aprovar"], "pessoa", { perguntar: async () => "1" });
  assert.ok(aprovou(A, r2, "especificacao"), "por número, aprova");
  // (3) seção aprovada mudou: erro até reabrir; aviso com o gate reaberto
  mexer(A, r1);
  const v1 = await A.z(["validar"]);
  assert.equal(v1.codigo, 1, "sem o gate reaberto, o validar recusa");
  assert.ok((await A.z(["pendentes", "--de", "ana"])).j.dados.reabrir.some((x) => x.no === r1), "o pendentes avisa");
  assert.equal((await A.z(["avancar", r1])).codigo, 3);
  const v2 = await A.z(["validar"]);
  assert.equal(v2.codigo, 0, `com o gate reaberto, só aviso: ${JSON.stringify(v2.j?.erros)}`);
});
