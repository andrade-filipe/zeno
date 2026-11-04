// gate humano com chave de teste injetada (ctx.segredo/ctx.home), caixa --aprovar (T53), ajustar, chave.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicKey } from "node:crypto";
import { alvo, noM, noP, ESPEC_M, EXEC_ENTREGA, PASS } from "./ajuda.mjs";
import { valida } from "../core/assinatura.mjs";
import { parseYaml } from "../core/yaml.mjs";

const pessoasDe = (A) => parseYaml(A.ler(".agents/sistema.yaml")).obj.pessoas;

const T0 = "2030-01-01T10:00:00Z";
let n = 0;
async function mAteEntrega(A) {
  A.relogio(Date.parse(T0) + (n++) * 60000);
  const id = await noM(A);
  assert.equal((await A.z(["avancar", id, "--ate", "fim", ...ESPEC_M])).codigo, 3);
  return id;
}

test("gate humano: agente não decide (3); pessoa no TTY aprova com assinatura válida e espera medida", async () => {
  const A = await alvo();
  const id = await mAteEntrega(A);
  assert.equal((await A.z(["gate", id, "--aprovar"])).codigo, 3);
  assert.equal((await A.z(["gate", id, "--aprovar"], "sem-tty")).codigo, 3);
  A.relogio(Date.parse(A.ledger().find((e) => e.ev === "gate.aberto").ts) + 2.5 * 3600000);
  const r = await A.z(["gate", id, "--aprovar", "--motivo", "ok"], "pessoa");
  assert.equal(r.codigo, 0, r.stdout);
  const g = A.ledger().find((e) => e.ev === "gate.decidido" && e.dados.tipo === "humano");
  assert.equal(g.ator, "ana");
  assert.equal(g.dados.espera_ms, 2.5 * 3600000);
  assert.match(g.dados.artefato_sha256, /^[0-9a-f]{64}$/);
  assert.ok(valida(g, pessoasDe(A)), "assinatura confere com a chave_pub do sistema.yaml");
  assert.match(A.fio(id), /· decisao · /);
  const st = await A.z(["status", id]);
  assert.match(st.stdout, /"fase":"execucao"|execucao/);
});

test("gate: reprovar pede motivo; passphrase errada falha sem evento", async () => {
  const A = await alvo();
  const id = await mAteEntrega(A);
  assert.equal((await A.z(["gate", id, "--reprovar"], "pessoa")).codigo, 2);
  const antes = A.ledger().length;
  const r = await A.z(["gate", id, "--aprovar"], "pessoa", { segredo: async () => "errada" });
  assert.notEqual(r.codigo, 0);
  assert.equal(A.ledger().filter((e) => e.ev === "gate.decidido" && e.dados.tipo === "humano").length, 0);
  assert.ok(A.ledger().length >= antes);
});

test("D40: a passphrase errada pede de novo até 3 vezes; a escolha da caixa não se perde; a 3ª errada recusa", async () => {
  const A = await alvo();
  const id = await mAteEntrega(A);
  const seq = (...xs) => { let n = 0; return { segredo: async () => xs[Math.min(n++, xs.length - 1)], get n() { return n; } }; };
  const vistos = [];
  let s = seq("errada", "errada", PASS);
  const ok = await A.z(["caixa", "--aprovar"], "pessoa", { segredo: s.segredo, perguntar: async () => "todos", mostrar: (t) => vistos.push(t) });
  assert.equal(ok.codigo, 0, JSON.stringify(ok.j?.erros));
  assert.equal(s.n, 3, "pediu 3 vezes");
  assert.ok(vistos.some((t) => /passphrase errada \(tentativa 2 de 3\)/.test(t)));
  assert.ok(A.ledger().some((e) => e.ev === "gate.decidido" && e.no === id && e.dados.tipo === "humano"), "a escolha da caixa valeu");
  const B = await alvo();
  const idB = await mAteEntrega(B);
  s = seq("errada");
  const nao = await B.z(["gate", idB, "--aprovar"], "pessoa", { segredo: s.segredo });
  assert.equal(nao.codigo, 1);
  assert.equal(s.n, 3, "desiste na 3ª");
  assert.equal(B.ledger().filter((e) => e.ev === "gate.decidido" && e.dados.tipo === "humano").length, 0);
  s = seq("errada", PASS);
  assert.equal((await B.z(["chave", "pub"], "pessoa", { segredo: s.segredo })).codigo, 0, "o chave pub também repete");
});

test("D40: depois do todos, a caixa pergunta pelo MUDOU; número aprova no mesmo lote, enter pula", async () => {
  const mexer = (A, id) => A.escrever(`.agents/trabalho/${id}.md`, A.no(id).replace("## Especificação\n", "## Especificação\n\nmudou depois do gate\n"));
  const aprovou = (A, id) => A.ledger().some((e) => e.no === id && e.ev === "gate.decidido" && e.dados.tipo === "humano" && e.dados.decisao === "aprovado");
  for (const [segunda, espera] of [["", false], ["2", true]]) {
    const A = await alvo();
    const a = await noM(A, "Normal"), b = await noM(A, "Mudado");
    for (const id of [a, b]) assert.equal((await A.z(["avancar", id, "--ate", "fim", ...ESPEC_M])).codigo, 3);
    mexer(A, b);
    const perguntas = [], resp = ["todos", segunda];
    let segredos = 0;
    const r = await A.z(["caixa", "--aprovar"], "pessoa", { perguntar: async (q) => { perguntas.push(q); return resp.shift() ?? ""; }, segredo: async () => { segredos++; return PASS; } });
    assert.equal(r.codigo, 0, JSON.stringify(r.j?.erros));
    assert.match(perguntas[1], /E o MUDOU \(2 mudado\)\? número para aprovar/);
    assert.ok(aprovou(A, a), "o todos aprova o normal");
    assert.equal(aprovou(A, b), espera, segunda ? "o número aprova o MUDOU" : "enter pula o MUDOU");
    assert.equal(segredos, 1, "uma passphrase para o lote");
  }
});

test("M ponta a ponta: dois gates humanos, Entrega aprovada pelo dono, fecha", async () => {
  const A = await alvo();
  const id = await mAteEntrega(A);
  assert.equal((await A.z(["gate", id, "--aprovar"], "pessoa")).codigo, 0);
  const r = await A.z(["avancar", id, "--ate", "fim", ...EXEC_ENTREGA]);
  assert.equal(r.codigo, 3, r.stdout);
  assert.equal(r.j.dados.estado, "em-gate");
  assert.equal((await A.z(["gate", id, "--aprovar"], "pessoa")).codigo, 0);
  // T102: o M nasce com janela 7d; antes do prazo a Observação não sai e o pendentes não acusa
  assert.match(A.no(id), /^janela: 7d$/m);
  const entrega = Date.parse(A.ledger().findLast((e) => e.ev === "fase.avancou" && e.dados.de === "entrega").ts);
  const cedo = await A.z(["avancar", id, "--ate", "fim"]);
  assert.equal(cedo.codigo, 1, "sem janela 0d, a CLI não escreve 'sem janela': pede o observado");
  A.relogio(entrega + 7 * 86400000 - 60000);
  assert.ok(!(await A.z(["pendentes"])).j.dados.observar.includes(id), "1 min antes do prazo: não vencida");
  assert.equal((await A.z(["avancar", id, "--ate", "fim", "--observado", "sem sinal"])).codigo, 1);
  assert.ok(A.ledger().some((e) => e.ev === "recusa" && e.no === id && e.dados.regra === "janela"), "a janela recusa antes do prazo");
  A.relogio(entrega + 7 * 86400000);
  assert.ok((await A.z(["pendentes"])).j.dados.observar.includes(id), "no prazo: vencida");
  const f = await A.z(["avancar", id, "--ate", "fim", "--atrito", "tentou sair da Observação 1 min antes do prazo"]);
  assert.equal(f.codigo, 0, f.stdout);
  assert.equal(f.j.dados.fase, "fechado");
  assert.equal((await A.z(["validar"])).codigo, 0);
});

test("T102: a janela nasce pelo tamanho (P 3d, M e G 7d); a expressa fica em 0d; --janela explícito vale", async () => {
  const A = await alvo();
  const nasce = async (args) => { const r = await A.z(["novo", ...args]); assert.equal(r.codigo, 0, JSON.stringify(r.j?.erros)); return A.ledger().findLast((e) => e.ev === "no.criado").dados.janela; };
  assert.equal(await nasce(["P comum", "--tamanho", "P"]), "3d");
  assert.equal(await nasce(["M comum", "--tamanho", "M", "--porque", "t", "--para", "t", "--fora", "t"]), "7d");
  assert.equal(await nasce(["G comum", "--tamanho", "G", "--porque", "t", "--para", "t", "--fora", "t"]), "7d");
  assert.equal(await nasce(["P expressa", "--expressa", "--porque", "t"]), "0d");
  assert.equal(await nasce(["P com janela", "--tamanho", "P", "--janela", "12h"]), "12h");
});

test("seção aprovada que muda reabre o gate (T15)", async () => {
  const A = await alvo();
  const id = await mAteEntrega(A);
  await A.z(["gate", id, "--aprovar"], "pessoa");
  const p = `.agents/trabalho/${id}.md`;
  A.escrever(p, A.ler(p).replace("- pronto: o teste passa", "- pronto: outra coisa"));
  const r = await A.z(["avancar", id, "--feito", "f"]);
  assert.equal(r.codigo, 3);
  assert.ok(A.ledger().some((e) => e.ev === "gate.aberto" && e.dados.reabertura));
});

test("caixa --aprovar (T53): lista, uma passphrase, um evento assinado por gate", async () => {
  const A = await alvo();
  const a = await mAteEntrega(A), b = await mAteEntrega(A), c = await mAteEntrega(A);
  assert.equal((await A.z(["caixa", "--aprovar"])).codigo, 3, "agente não aprova em lote");
  const antes = A.segredos;
  A.responder("1,3");
  const r = await A.z(["caixa", "--aprovar"], "pessoa");
  assert.equal(r.codigo, 0, r.stdout);
  assert.deepEqual(r.j.dados.aprovados.sort(), [a, c].sort());
  assert.equal(A.segredos - antes, 1, "uma passphrase só");
  const gs = A.ledger().filter((e) => e.ev === "gate.decidido" && e.dados.tipo === "humano");
  assert.equal(gs.length, 2);
  for (const g of gs) assert.ok(valida(g, pessoasDe(A)));
  assert.match(r.stderr, /Caixa de ana · 3 gates/, "D40: o resumo lista os 3");
  A.responder("todos");
  const r2 = await A.z(["caixa", "--aprovar"], "pessoa");
  assert.deepEqual(r2.j.dados.aprovados, [b]);
  A.responder("");
  assert.match((await A.cru(["caixa", "--aprovar"], "pessoa")).stdout, /nenhum gate/);
});

test("pendentes mostra o gate com a espera; disjuntor e orçamento por gate assinado", async () => {
  const A = await alvo();
  const id = await mAteEntrega(A);
  A.relogio(Date.parse(A.ledger().find((e) => e.ev === "gate.aberto").ts) + 3 * 3600000);
  const p = await A.z(["pendentes", "--de", "ana"]);
  assert.equal(p.j.dados.gates[0].no, id);
  assert.equal(p.j.dados.gates[0].espera_ms, 3 * 3600000);
});

test("pendentes (T84): Observação vencida vai para o executor, não para a pessoa (D36)", async () => {
  const A = await alvo();
  const id = await noP(A, "Com janela", ["--janela", "1d"]);
  await A.z(["avancar", id, "--ate", "fim", "--pronto", "p", "--feito", "f", "--evidencia", "e", "--ref", "x.md", "--desfazer", "mover para _lixo"]);
  A.relogio(Date.now() + 2 * 86400000);
  assert.deepEqual((await A.z(["pendentes", "--de", "ana"])).j.dados.observar, [], "a pessoa não recebe a Observação do agente");
  assert.deepEqual((await A.z(["pendentes"])).j.dados.observar, [id], "o executor recebe");
});

test("disjuntor: gasto acima do teto pausa o nó; só pessoa amplia com gate --orcamento", async () => {
  const A = await alvo();
  const id = await noP(A, "Com teto", ["--orcamento", "tokens=100"]);
  assert.equal((await A.z(["registrar", "gasto", id, "--tokens", "100"])).codigo, 0, "no teto não dispara (>)");
  const r = await A.z(["registrar", "gasto", id, "--tokens", "1"]);
  assert.equal(r.codigo, 4);
  assert.ok(A.ledger().some((e) => e.ev === "disjuntor.disparou"));
  assert.match(A.fio(id), /· escalada · /);
  assert.equal((await A.z(["avancar", id, "--pronto", "p"])).codigo, 4);
  assert.equal((await A.z(["gate", id, "--orcamento", "tokens=+500"])).codigo, 3);
  assert.equal((await A.z(["ajustar", id, "orcamento=tokens=900"])).codigo, 2);
  assert.equal((await A.z(["gate", id, "--orcamento", "tokens=+500"], "pessoa")).codigo, 0);
  assert.equal((await A.z(["avancar", id, "--pronto", "p"])).codigo, 0);
});

test("T93: gate --teto libera o teto diário do alvo só no dia, só pessoa, assinado", async () => {
  const A = await alvo();
  const id = await noP(A);
  assert.equal((await A.z(["registrar", "gasto", id, "--usd", "0.5"])).codigo, 4, "usd: 0 estoura no 1º dólar");
  const novo = () => A.z(["novo", "outro", "--expressa", "--porque", "x"]);
  const preso = await novo();
  assert.equal(preso.codigo, 4);
  assert.match(preso.stdout + preso.stderr, /zeno gate --teto usd=\+N/, "a recusa diz como liberar");
  assert.equal((await A.z(["gate", "--teto", "usd=+1"])).codigo, 3, "agente não libera");
  assert.equal((await A.z(["gate", "--teto", "tokens=+10"], "pessoa")).codigo, 2, "tokens sem teto: nada a liberar");
  assert.equal((await A.z(["gate", "--teto", "usd=1"], "pessoa")).codigo, 2, "só para cima, com +");
  const r = await A.z(["gate", "--teto", "usd=+1"], "pessoa");
  assert.equal(r.codigo, 0, r.stdout);
  const lib = A.ledger().at(-1);
  assert.equal(lib.ev, "orcamento.alterado"); assert.equal(lib.no, null);
  assert.deepEqual(lib.dados, { dia: lib.ts.slice(0, 10), acrescimo: { usd: 1 } });
  assert.ok(valida(lib, pessoasDe(A)), "assinada");
  assert.equal((await novo()).codigo, 0, "liberado no dia");
  assert.equal((await A.z(["registrar", "gasto", id, "--usd", "0.6"])).codigo, 4, "0,5 + 0,6 passa de 0 + 1: estoura de novo");
  assert.equal(A.ledger().filter((e) => e.ev === "teto_diario.estourou").length, 2, "o estouro conta de novo depois da liberação");
  // a virada: a liberação vale só para o dia dela
  const proj = (await import("../core/projecao.mjs"));
  const dia = lib.dados.dia, amanha = new Date(Date.parse(dia) + 864e5).toISOString().slice(0, 10);
  const p = { alvo: { gastoDia: new Map([[amanha, { tokens: 0, usd: 0.5 }]]), tetoExtra: new Map([[dia, { tokens: 0, usd: 1 }]]) } };
  assert.deepEqual(proj.tetoDiario(p, { teto: { tokens: null, usd: 0 } }, amanha), { dimensao: "usd", consumo: 0.5, teto: 0 });
});

test("ajustar: apertar é livre; afrouxar pede pessoa, motivo e assinatura", async () => {
  const A = await alvo();
  const id = await noP(A);
  const r = await A.z(["ajustar", id, "faixa=aprovacao"]);
  assert.equal(r.codigo, 0, r.stdout);
  assert.equal((await A.z(["ajustar", id, "faixa=autonoma"])).codigo, 3);
  assert.equal((await A.z(["ajustar", id, "faixa=autonoma"], "pessoa")).codigo, 2);
  const ok = await A.z(["ajustar", id, "faixa=autonoma", "--motivo", "era P mesmo"], "pessoa");
  assert.equal(ok.codigo, 0, ok.stdout);
  const aj = A.ledger().filter((e) => e.ev === "ajuste");
  assert.equal(aj.at(-1).dados.afrouxa, true);
  assert.ok(valida(aj.at(-1), pessoasDe(A)));
  assert.equal((await A.z(["ajustar", id, "origem+=web:x"])).codigo, 0);
  assert.match(A.no(id), /procedencia: nao-confiavel/);
  assert.equal((await A.z(["ajustar", id, "estado=cancelado"])).codigo, 3, "cancelar fora de autônoma é de pessoa");
});

test("chave nova: só pessoa; grava cifrada sem sobrescrever", async () => {
  const A = await alvo({ chave: false });
  assert.equal((await A.z(["chave", "nova"])).codigo, 3);
  const r = await A.z(["chave", "nova"], "pessoa");
  assert.equal(r.codigo, 0, r.stdout);
  const k = join(A.home, ".config", "zeno", "ana.key");
  assert.ok(existsSync(k));
  assert.match(readFileSync(k, "utf8"), /ENCRYPTED PRIVATE KEY/);
  assert.notEqual((await A.z(["chave", "nova"], "pessoa")).codigo, 0, "não sobrescreve");
});

test("chave pub: só pessoa; a pública sai da privada (linha, PEM, arquivo novo); avisa se não bate com o sistema.yaml", async () => {
  const A = await alvo();
  for (const q of ["agente", "sem-tty"]) assert.equal((await A.z(["chave", "pub"], q)).codigo, 3, q);
  const vistos = [];
  const r = await A.cru(["chave", "pub"], "pessoa", { mostrar: (t) => vistos.push(t) });
  assert.equal(r.codigo, 0, r.stderr);
  assert.equal(r.stdout, `chave_pub: "${A.pub}"\n`);
  assert.deepEqual(vistos, [], "bate com o sistema.yaml: sem aviso");
  const pem = await A.cru(["chave", "pub", "--pem"], "pessoa");
  assert.match(pem.stdout, /^-----BEGIN PUBLIC KEY-----\n.+\n-----END PUBLIC KEY-----\n$/s);
  assert.equal(createPublicKey(pem.stdout).export({ type: "spki", format: "der" }).toString("base64"), A.pub);
  const f = join(A.home, "pessoa.pub");
  assert.equal((await A.z(["chave", "pub", "--em", f], "pessoa")).codigo, 0);
  assert.equal(readFileSync(f, "utf8"), pem.stdout);
  assert.equal((await A.z(["chave", "pub", "--em", f], "pessoa")).codigo, 1, "não sobrescreve o arquivo");
  assert.equal(readFileSync(f, "utf8"), pem.stdout);
  A.escrever(".agents/sistema.yaml", A.ler(".agents", "sistema.yaml").replace(A.pub, "MCowBQYDK2VwAyEAoutraoutraoutraoutraoutraoutraoutraoutraoutr="));
  const outro = [];
  assert.equal((await A.z(["chave", "pub"], "pessoa", { mostrar: (t) => outro.push(t) })).codigo, 0);
  assert.match(outro.join("\n"), /NÃO confere/);
  assert.equal((await A.z(["chave", "pub"], "pessoa", { segredo: async () => "errada-errada" })).codigo, 1, "passphrase errada");
});

test("cartão (T75, D40): a caixa abre com o resumo; o de risco baixo fica fechado e 'v N' o mostra antes da passphrase; o lint recusa", async () => {
  const A = await alvo();
  const id = await mAteEntrega(A);
  const visto = [], respostas = ["v 1", "todos"];
  let antesDaV = null, antesDaPassphrase = null;
  const r = await A.z(["caixa", "--aprovar"], "pessoa", { mostrar: (t) => visto.push(t), perguntar: async () => { antesDaV ??= visto.join("\n"); return respostas.shift() ?? ""; },
    segredo: async () => { antesDaPassphrase = visto.join("\n"); return "passphrase-de-teste"; } });
  assert.equal(r.codigo, 0, r.stdout);
  assert.match(antesDaV, /Caixa de ana · 1 gate · 0 de risco alto · 0 mudaram/);
  assert.match(antesDaV, /^ 1 +Especificação +registro +baixo +Tarefa média$/m);
  assert.doesNotMatch(antesDaV, /Muda +o arquivo/, "risco baixo: fechado no resumo");
  for (const l of [/Muda +o arquivo de teste muda/, /Porquê +o teste pede a mudança/, /Risco +baixo · só o teste/, /Desfazer +mover para _lixo/,
    /Reprovar +o arquivo fica como está/, /Conferir +1\. o arquivo\n +2\. o teste/]) assert.match(antesDaPassphrase, l);
  const B = await alvo();
  const b = await noM(B);
  assert.equal((await B.z(["avancar", b, "--cartao-x", "algo"])).codigo, 2);
  const c = await noM(B, "Outra tarefa");
  const cartao = (risco, conferir, muda = "o arquivo muda") => ["--pronto", "p", "--restricoes", "r", "--riscos", "baixo", "--cartao-muda", muda, "--cartao-porque", "o teste pede", "--cartao-risco", risco,
    "--cartao-desfazer", "mover para _lixo", "--cartao-reprovar", "fica como está", "--cartao-conferir", conferir];
  const falta = async (args) => { assert.equal((await B.z(["avancar", c, "--ate", "fim", ...args])).codigo, 1); return B.ledger().filter((e) => e.ev === "artefato.incompleto").at(-1).dados.faltando; };
  assert.deepEqual(await falta(cartao("baixo: só teste", "(1) a; (2) b; (3) c; (4) d")), ["cartao-conferir"]);
  assert.deepEqual(await falta(cartao("só teste", "(1) o arquivo")), ["cartao-risco"], "D40: o risco começa pelo nível");
  assert.deepEqual(await falta(cartao("nenhum: só teste", "(1) o arquivo", "x".repeat(161))), ["cartao-muda"], "D40: teto de 160 por campo");
  assert.deepEqual(await falta(cartao("alto: só teste", `(1) ${"y".repeat(101)}`)), ["cartao-conferir"], "D40: teto de 100 por item do conferir");
});

test("caixa --aprovar mostra a lista ANTES de perguntar; sem chave_pub recusa antes de pedir passphrase", async () => {
  const A = await alvo();
  await mAteEntrega(A);
  const ordem = [];
  const r = await A.z(["caixa", "--aprovar"], "pessoa", { mostrar: (t) => ordem.push("lista"), perguntar: async () => { ordem.push("pergunta"); return ""; } });
  assert.equal(r.codigo, 0);
  assert.deepEqual(ordem, ["lista", "pergunta"]);
  const B = await alvo({ chave: false });
  await mAteEntrega(B);
  let perguntou = false;
  const r2 = await B.z(["caixa", "--aprovar"], "pessoa", { perguntar: async () => { perguntou = true; return "todos"; } });
  assert.equal(r2.codigo, 1);
  assert.match(r2.j.erros[0].msg, /chave_pub/);
  assert.equal(perguntou, false);
  assert.equal(B.segredos, 0, "não pediu passphrase");
  assert.equal((await B.z(["gate", "x", "--aprovar"], "pessoa")).codigo, 1);
});

test("T114: toda rodada da caixa depois da tela grava caixa.mostrada, sem assinatura e só com ids e números", async () => {
  const A = await alvo();
  A.relogio(Date.parse(T0));
  const a = await noM(A, "Normal"), b = await noM(A, "Mudado");
  for (const id of [a, b]) assert.equal((await A.z(["avancar", id, "--ate", "fim", ...ESPEC_M])).codigo, 3);
  const rodadas = () => A.ledger().filter((e) => e.ev === "caixa.mostrada");
  const humanos = () => A.ledger().filter((e) => e.ev === "gate.decidido" && e.dados.tipo === "humano");
  // (4) agente recebe 3 e nada é gravado
  assert.equal((await A.z(["caixa", "--aprovar"])).codigo, 3);
  assert.equal(rodadas().length, 0);
  // (1) resposta vazia: o evento, de alvo, sem assinatura, com o ator do processo; nenhum gate.decidido
  assert.equal((await A.z(["caixa", "--aprovar"], "pessoa", { perguntar: async () => "" })).codigo, 0);
  const [v] = rodadas();
  assert.equal(v.no, null); assert.equal(v.assinatura, undefined); assert.equal(v.ator, "ana");
  assert.deepEqual([...v.dados.listados].sort(), [a, b].sort());
  assert.equal(v.dados.resposta, "vazio"); assert.deepEqual(v.dados.escolhidos, []);
  assert.equal(humanos().length, 0);
  // (3) escolha inválida sai 2 e o evento fica
  assert.equal((await A.z(["caixa", "--aprovar"], "pessoa", { perguntar: async () => "9" })).codigo, 2);
  assert.equal(rodadas().length, 2); assert.equal(rodadas().at(-1).dados.resposta, "invalida");
  // (2) "todos" com um MUDOU e enter: mudou_pulado com o id, escolhidos sem ele, no mesmo cmd dos gate.decidido
  A.escrever(`.agents/trabalho/${b}.md`, A.no(b).replace("## Especificação\n", "## Especificação\n\nmudou depois do gate\n"));
  const nb = v.dados.listados.indexOf(b) + 1, resp = [`v ${nb}`, "todos", ""];
  const r = await A.z(["caixa", "--aprovar"], "pessoa", { perguntar: async () => { A.relogio(Date.parse(T0) + 90000); return resp.shift() ?? ""; } });
  assert.equal(r.codigo, 0, r.stdout);
  const t = rodadas().at(-1), g = humanos();
  assert.equal(t.dados.resposta, "todos");
  assert.deepEqual(t.dados.mudou, [b]); assert.deepEqual(t.dados.mudou_pulado, [b]);
  assert.deepEqual(t.dados.escolhidos, [a]); assert.deepEqual(t.dados.vistos, [b]);
  assert.ok(t.dados.abertos.includes(b), "o MUDOU abre sozinho");
  assert.equal(t.dados.leitura_ms, 90000);
  assert.deepEqual(g.map((e) => e.no), [a]); assert.equal(g[0].cmd, t.cmd);
  // a passphrase recusada também deixa a rodada
  const antes = rodadas().length;
  assert.equal((await A.z(["caixa", "--aprovar"], "pessoa", { perguntar: async () => "1", segredo: async () => "errada" })).codigo, 1);
  assert.equal(rodadas().length, antes + 1); assert.equal(rodadas().at(-1).dados.resposta, "numeros");
  assert.equal(humanos().length, 1);
  // (5) os dados têm só ids e números (e a resposta, de um conjunto fechado)
  const ids = new Set([a, b]);
  for (const e of rodadas()) for (const [k, x] of Object.entries(e.dados)) {
    if (k === "resposta") assert.ok(["todos", "numeros", "vazio", "invalida"].includes(x));
    else if (k === "leitura_ms") assert.equal(typeof x, "number");
    else assert.ok(Array.isArray(x) && x.every((i) => ids.has(i)), `${k}: ${JSON.stringify(x)}`);
  }
});
