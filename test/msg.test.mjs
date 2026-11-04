// msg, caixa, pendentes, contexto, registrar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { alvo, noP, noM } from "./ajuda.mjs";

const PEDIDO = ["--objetivo", "trocar o link do README pelo novo", "--saida", "um commit", "--ferramentas", "Edit", "--fronteira", "só o README", "--parada", "o commit", "--checagem", "o link abre"];

test("msg pedido: lint passa, a cláusula entra e o fio guarda a mensagem", async () => {
  const A = await alvo();
  const id = await noP(A);
  const r = await A.z(["msg", id, "pedido", "--para", "ia:claude", ...PEDIDO]);
  assert.equal(r.codigo, 0, r.stdout);
  const fio = A.fio(id);
  assert.match(fio, new RegExp(`### ${r.j.dados.msg} · pedido · `));
  assert.match(fio, /- \*\*clausula:\*\* \(m-[^)]+\) não contorne/);
  assert.ok(A.ledger().some((e) => e.ev === "msg.enviada" && e.dados.bytes > 0));
});

test("msg: campo faltando, campo vazio de sentido e destinatário desconhecido viram msg.recusada", async () => {
  const A = await alvo();
  const id = await noP(A);
  const r = await A.z(["msg", id, "pergunta", "--para", "ana", "--contexto", "ok", "--opcoes", "a ou b"]);
  assert.equal(r.codigo, 1);
  const regras = r.j.erros.map((e) => e.regra);
  assert.ok(regras.includes("campos") && regras.includes("autossuficiente"), regras.join());
  assert.equal((await A.z(["msg", id, "aviso", "--para", "zeca", "--o-que", "algo concreto"])).codigo, 1);
  assert.equal((await A.z(["msg", id, "fofoca", "--para", "ana"])).codigo, 1);
  assert.equal((await A.z(["msg", id, "resposta", "--para", "ana", "--responde-a", "m-nao-existe", "--resposta", "sim"])).codigo, 1);
  assert.equal(A.ledger().filter((e) => e.ev === "msg.recusada").length, 4);
});

test("caixa e pendentes: pergunta para a pessoa fica aberta até uma pessoa responder", async () => {
  const A = await alvo();
  const id = await noP(A);
  const p = await A.z(["msg", id, "pergunta", "--para", "ana", "--contexto", "o link mudou de domínio", "--opcoes", "a: trocar; b: remover", "--recomendacao", "a", "--bloqueia", "a Entrega"]);
  assert.equal(p.codigo, 0, p.stdout);
  const mid = p.j.dados.msg;
  let c = await A.z(["caixa", "--de", "ana"]);
  assert.equal(c.j.dados.mensagens.length, 1);
  // resposta de agente não fecha pergunta para pessoa (e a própria resposta entra na caixa: "lido" não existe)
  await A.z(["msg", id, "resposta", "--para", "ana", "--responde-a", mid, "--resposta", "acho que a"]);
  c = await A.z(["caixa", "--de", "ana"]);
  assert.ok(c.j.dados.mensagens.some((m) => m.id === mid));
  assert.equal((await A.z(["pendentes", "--de", "ana"])).j.dados.caixa, 2);
  const r = await A.z(["msg", id, "resposta", "--para", "ia:claude", "--responde-a", mid, "--resposta", "a: trocar"], "pessoa");
  assert.equal(r.codigo, 0, r.stdout);
  c = await A.z(["caixa", "--de", "ana"]);
  assert.ok(!c.j.dados.mensagens.some((m) => m.id === mid));
});

test("contexto monta as 6 camadas e registra contexto.montado com bytes", async () => {
  const A = await alvo();
  A.escrever("ref.md", "linha 1\nlinha 2\nlinha 3\n");
  const pai = await noM(A, "Pai grande");
  const id = await noP(A, "Filho do pai", ["--pai", pai, "--refs", "ref.md#L2-L3"]);
  const r = await A.z(["contexto", id]);
  assert.equal(r.codigo, 0, r.stdout);
  const c = r.j.dados.camadas;
  assert.match(c.no, /Especificação do pai/);
  assert.match(c.cartao, /\S/);
  assert.match(c.refs, /linha 2\nlinha 3/);
  assert.doesNotMatch(c.refs, /linha 1/);
  const e = A.ledger().find((x) => x.ev === "contexto.montado");
  assert.equal(e.dados.fase, "intencao");
  assert.ok(e.dados.bytes > 0);
  assert.match((await A.z(["contexto", id, "--sem-agents"])).j.dados.camadas.agents, /já carregado/);
});

test("registrar --retro: nó criado e fechado com ts do fato; gasto declarado", async () => {
  const A = await alvo();
  const r = await A.z(["registrar", "Spec técnica", "--retro", "--tamanho", "P", "--expressa", "--porque", "pré-Zeno", "--inicio", "2026-11-01T09:00:00Z", "--fim", "2026-11-01T18:00:00Z",
    "--pronto", "spec revista", "--feito", "spec escrita", "--evidencia", "crítica adversarial", "--ref", "ac87e56", "--desfazer", "git revert"]);
  assert.equal(r.codigo, 0, r.stdout);
  assert.equal(r.j.dados.fase, "fechado");
  const evs = A.ledger().filter((e) => e.no === r.j.dados.id);
  assert.ok(evs.every((e) => e.retro === true && e.ts_fato));
  assert.equal(evs.find((e) => e.ev === "no.criado").ts_fato, "2026-11-01T09:00:00.000Z");
  const g = await A.z(["registrar", "gasto", r.j.dados.id, "--tokens", "1200"]);
  assert.equal(g.codigo, 0);
  assert.equal(A.ledger().at(-1).dados.fonte, "declarado");
  assert.equal((await A.z(["registrar", "x", "--tamanho", "P"])).codigo, 2);
});

test("teto diário zero em usd: gasto em usd estoura e bloqueia nós novos no dia", async () => {
  const A = await alvo();
  const id = await noP(A);
  const r = await A.z(["registrar", "gasto", id, "--usd", "0.5"]);
  assert.equal(r.codigo, 4);
  assert.ok(A.ledger().some((e) => e.ev === "teto_diario.estourou"));
  assert.equal((await A.z(["novo", "outro", "--expressa", "--porque", "x"])).codigo, 4);
});
