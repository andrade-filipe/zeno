// probe trava-sensor (T117): o nó de sensor (origem sensor:<nome>) passa da trava só uma vez por sensor por semana ISO, e
// no máximo 5 por semana no alvo; o que passa sai com código 1 e nada é gravado.
import { test } from "node:test"; import assert from "node:assert/strict"; import { alvo } from "../ajuda.mjs";
test("probe trava-sensor", async () => {
  const A = await alvo();
  A.relogio(Date.parse("2026-11-04T10:00:00Z"));
  const s = (nome, t) => A.z(["novo", t, "--tamanho", "P", "--porque", "teto", "--origem", `sensor:${nome}`]);
  assert.equal((await s("retro", "Um")).codigo, 0);
  assert.equal((await s("retro", "Dois")).codigo, 1, "o 2º do mesmo sensor na semana passou");
  for (const n of ["b", "c", "d", "e"]) assert.equal((await s(n, `Sensor ${n}`)).codigo, 0);
  assert.equal((await s("f", "Seis")).codigo, 1, "o 6º nó de sensor da semana passou");
});
