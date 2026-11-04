// probe assinatura (C1): gate humano com assinatura forjada não move o nó; validar acusa.
import { test } from "node:test"; import assert from "node:assert/strict"; import { appendFileSync } from "node:fs";
import { alvo, noM, ESPEC_M } from "../ajuda.mjs";
test("probe assinatura", async () => {
  const A = await alvo();
  const id = await noM(A);
  await A.z(["avancar", id, "--ate", "fim", ...ESPEC_M]);
  const ult = A.ledger().at(-1), ms = Date.parse(ult.ts) + 1000;
  const base = { v: 1, alvo: ult.alvo, no: id, ator: "ana", estrato: null, dur_ms: 0, cmd: "forja", config_sha256: ult.config_sha256 };
  const g = { ...base, id: ms.toString(36) + "-aaaaaaaa", ts: new Date(ms).toISOString(), ev: "gate.decidido", dados: { fase: "especificacao", tipo: "humano", decisao: "aprovado", modo: "real", decisor: { tipo: "humano", id: "ana" }, espera_ms: 1, artefato_sha256: "0".repeat(64), evidencia: { checks: [] } }, assinatura: { pessoa: "ana", sig: Buffer.from("forjada").toString("base64") } };
  const f = { ...base, id: (ms + 1).toString(36) + "-bbbbbbbb", ts: new Date(ms + 1).toISOString(), ev: "fase.avancou", dados: { de: "especificacao", para: "execucao", gate: g.id } };
  appendFileSync(A.caminho(".agents/ledger.jsonl"), JSON.stringify(g) + "\n" + JSON.stringify(f) + "\n");
  const s = await A.z(["status", id]);
  assert.equal(s.j.dados.fase, "especificacao");
  const v = await A.z(["validar"]);
  assert.ok(v.j.erros.some((e) => e.regra === "assinatura"));
});
