// probe pausa-fato (T98): a pausa do disjuntor é regra da projeção, não só da CLI. Um fase.avancou ou gate.aberto
// gravado num nó pausado (ledger forjado) não muda o nó, e o validar acusa.
import { test } from "node:test"; import assert from "node:assert/strict"; import { appendFileSync } from "node:fs";
import { alvo, noP } from "../ajuda.mjs";
test("probe pausa-fato", async () => {
  const A = await alvo();
  const id = await noP(A, "Preso", ["--orcamento", "tokens=10"]);
  assert.equal((await A.z(["registrar", "gasto", id, "--tokens", "11"])).codigo, 4);
  const ult = A.ledger().at(-1);
  let ms = Date.parse(ult.ts) + 1000;
  const forja = (ev, dados) => {
    const f = { v: 1, alvo: ult.alvo, no: id, ator: "ia:claude", estrato: null, dur_ms: 0, cmd: "forja", config_sha256: ult.config_sha256,
      id: ms.toString(36) + "-aaaaaaaa", ts: new Date(ms).toISOString(), ev, dados };
    ms += 1000;
    appendFileSync(A.caminho(".agents/ledger.jsonl"), JSON.stringify(f) + "\n");
  };
  forja("gate.aberto", { fase: "intencao", papeis: [] });
  const st = (await A.z(["status", id])).j.dados;
  assert.equal(st.estado, "pausado", "o gate forjado não tira da pausa");
  assert.equal(st.fase, "intencao");
  const v = await A.z(["validar"]);
  assert.ok(v.j.erros.some((e) => e.regra === "pausado"), JSON.stringify(v.j.erros));
});
