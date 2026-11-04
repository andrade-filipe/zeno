// probe cartao-gate (T75, D36): gate humano sem cartão de decisão completo não abre; campo genérico também não.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo, noM, CARTAO } from "../ajuda.mjs";
const ESPEC = ["--pronto", "o teste passa", "--restricoes", "nenhuma", "--riscos", "baixo"];
test("probe cartao-gate", async () => {
  const A = await alvo();
  const id = await noM(A);
  const r = await A.z(["avancar", id, "--ate", "fim", ...ESPEC]);
  assert.equal(r.codigo, 1, "sem cartão o gate humano não abre");
  assert.equal(r.j.dados.estado, "ativo");
  assert.ok(!A.ledger().some((e) => e.ev === "gate.aberto"));
  const inc = A.ledger().filter((e) => e.ev === "artefato.incompleto").at(-1);
  assert.deepEqual(inc.dados.faltando, ["cartao-muda", "cartao-porque", "cartao-risco", "cartao-desfazer", "cartao-reprovar", "cartao-conferir"]);
  // campo genérico ("ok", lint.yaml) não vale como cartão
  const generico = CARTAO.map((x, i) => (CARTAO[i - 1] === "--cartao-risco" ? "ok" : x));
  const g = await A.cru(["avancar", id, ...generico]);
  assert.equal(g.codigo, 1, "risco: ok não se explica sozinho");
  assert.match(g.stdout + g.stderr, /cartão de decisão: cartao-risco não se explica sozinho \("ok"\)/);
  assert.ok(!A.ledger().some((e) => e.ev === "gate.aberto"));
  const r2 = await A.z(["avancar", id, ...CARTAO]);
  assert.equal(r2.codigo, 3, "com o cartão completo o gate abre");
  assert.match(A.no(id), /## Especificação[\s\S]*- cartao-muda: o arquivo de teste muda[\s\S]*## Execução/);
});
