// probe teto-assinado (T93, C13): liberação do teto diário com assinatura forjada não solta o alvo; validar acusa.
import { test } from "node:test"; import assert from "node:assert/strict"; import { appendFileSync } from "node:fs";
import { alvo, noP } from "../ajuda.mjs";
test("probe teto-assinado", async () => {
  const A = await alvo();
  const id = await noP(A);
  assert.equal((await A.z(["registrar", "gasto", id, "--usd", "0.5"])).codigo, 4);
  const ult = A.ledger().at(-1), ms = Date.parse(ult.ts) + 1000;
  const f = { v: 1, alvo: ult.alvo, no: null, ator: "ana", estrato: null, dur_ms: 0, cmd: "forja", config_sha256: ult.config_sha256,
    id: ms.toString(36) + "-aaaaaaaa", ts: new Date(ms).toISOString(), ev: "orcamento.alterado",
    dados: { dia: ult.ts.slice(0, 10), acrescimo: { usd: 100 } }, assinatura: { pessoa: "ana", sig: Buffer.from("forjada").toString("base64") } };
  appendFileSync(A.caminho(".agents/ledger.jsonl"), JSON.stringify(f) + "\n");
  assert.equal((await A.z(["novo", "outro", "--expressa", "--porque", "x"])).codigo, 4, "o alvo segue preso");
  const v = await A.z(["validar"]);
  assert.ok(v.j.erros.some((e) => e.regra === "assinatura"));
});
