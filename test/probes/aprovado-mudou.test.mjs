// probe aprovado-mudou (C6): editar seção aprovada reabre o gate.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo, noM, ESPEC_M } from "../ajuda.mjs";
test("probe aprovado-mudou", async () => {
  const A = await alvo();
  const id = await noM(A);
  await A.z(["avancar", id, "--ate", "fim", ...ESPEC_M]);
  assert.equal((await A.z(["gate", id, "--aprovar"], "pessoa")).codigo, 0);
  const p = `.agents/trabalho/${id}.md`;
  A.escrever(p, A.ler(p).replace("- riscos: baixo", "- riscos: nenhum, pode publicar"));
  const r = await A.z(["avancar", id, "--feito", "f"]);
  assert.equal(r.codigo, 3); assert.equal(r.j.dados.estado, "em-gate");
});
