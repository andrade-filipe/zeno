// probe promover-entrega (T79): o promover RECUSA, antes da passphrase, uma cópia que traria código de um nó cujo gate de
// Entrega não foi aprovado (via expressa de código fica de fora: ela não tem gate). Na caixa --aprovar, o gate de Entrega
// aprovado na mesma rodada conta, e o executar confere de novo depois de gravá-lo.
import { test } from "node:test"; import assert from "node:assert/strict";
import { alvo, noM, ESPEC_M, EXEC_ENTREGA, gitFalso, rodarOk } from "../ajuda.mjs";
import { ZENO_DIR } from "../../core/config.mjs";

const REF = "1234abcd";
const revs = `${REF}00000000000000000000000000000000\nabcdef1234567890abcd\n`;
const entrega = EXEC_ENTREGA.map((x, i, a) => (a[i - 1] === "--ref" ? REF : x));

test("probe promover-entrega", async () => {
  const A = await alvo();
  const id = await noM(A, "Codigo com gate");
  assert.equal((await A.z(["avancar", id, "--ate", "fim", ...ESPEC_M])).codigo, 3);
  A.responder("todos");
  assert.equal((await A.z(["caixa", "--aprovar"], "pessoa")).codigo, 0, "aprova a Especificação (alvo sem core/: sem promover)");
  const r = await A.z(["avancar", id, "--ate", "fim", ...entrega]);
  assert.equal(r.codigo, 3, JSON.stringify(r.j));
  const s0 = A.segredos;
  // com a Entrega em gate, o promover recusa sem pedir a passphrase e sem copiar nada
  const p = await A.z(["promover", "--de", ZENO_DIR], "pessoa", { rodar: rodarOk, git: gitFalso({ revs }) });
  assert.equal(p.codigo, 1, JSON.stringify(p.j));
  assert.ok(JSON.stringify(p.j).includes(id), "a recusa nomeia o nó");
  assert.equal(A.segredos, s0, "recusa antes da passphrase");
  assert.ok(!A.ledger().some((e) => e.ev === "zeno.promovido"));
  // na mesma rodada da caixa, aprovar a Entrega libera o promover, com uma passphrase só
  A.responder("todos");
  const c = await A.z(["caixa", "--aprovar", "--de", ZENO_DIR, "--promover"], "pessoa", { rodar: rodarOk, git: gitFalso({ revs }) });
  assert.equal(c.codigo, 0, JSON.stringify(c.j));
  assert.equal(A.segredos, s0 + 1, "uma passphrase na rodada");
  assert.deepEqual(A.ledger().find((e) => e.ev === "zeno.promovido")?.dados.nos, [id]);
});
