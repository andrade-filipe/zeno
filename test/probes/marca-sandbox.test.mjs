// probe marca-sandbox (T105): todo evento diz se veio de fora do zeno sessao (sem marcador: "fora", com certeza) ou de
// dentro ("sessao", declarado pelo marcador, com o id do sessao.aberta quando o lançador o gravou). A marca entra na
// assinatura, e o ledger antigo sem ela segue válido. Sem bwrap: o lançador roda com um executar injetado pelo ctx.
import { test } from "node:test"; import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { alvo, noP, noM, ESPEC_M } from "../ajuda.mjs";

const ledgerTxt = (A) => readFileSync(A.caminho(".agents/ledger.jsonl"), "utf8");
const hook = (A, over, command) => A.cru(["guarda", "pre-tool"], "agente", { ...over, entrada: async () => JSON.stringify({ cwd: A.dir, session_id: "s1", tool_name: "Bash", tool_input: { command } }) });

test("probe marca-sandbox", async () => {
  // (a) sem marcador: todo evento de novo, avancar, msg, registrar e guarda sai "fora" e sem sessao
  const A = await alvo();
  const id = await noP(A, "fora do sandbox");
  assert.equal((await A.z(["avancar", id, "--pronto", "p"])).codigo, 0);
  assert.equal((await A.z(["msg", id, "aviso", "--para", "ana", "--o-que", "aviso de fora do sandbox"])).codigo, 0);
  assert.equal((await A.z(["registrar", "gasto", id, "--tokens", "10"])).codigo, 0);
  assert.equal((await hook(A, {}, "echo > .agents/ledger.jsonl")).codigo, 0);
  const fora = A.ledger();
  for (const ev of ["no.criado", "fase.avancou", "msg.enviada", "gasto.registrado", "recusa"]) assert.ok(fora.some((e) => e.ev === ev), `faltou ${ev}`);
  for (const e of fora) { assert.equal(e.sandbox, "fora", `${e.ev} sem a marca fora`); assert.equal("sessao" in e, false, `${e.ev} com sessao`); }

  // (b) com o marcador "agente id": sandbox sessao e sessao = id; o marcador antigo (só o agente) não liga à sessão
  const n0 = A.ledger().length;
  const dentro = { marcador: "ia:teste mhgk2x1a-3f0c9a12\n", env: {} };
  assert.equal((await A.z(["novo", "dentro com id", "--expressa", "--porque", "y"], "agente", dentro)).codigo, 0);
  assert.equal((await hook(A, dentro, "echo > .agents/ledger.jsonl")).codigo, 0);
  const novos = A.ledger().slice(n0);
  assert.ok(novos.length >= 2 && novos.some((e) => e.ev === "recusa"));
  for (const e of novos) { assert.equal(e.sandbox, "sessao", e.ev); assert.equal(e.sessao, "mhgk2x1a-3f0c9a12", e.ev); }
  assert.equal((await A.z(["novo", "dentro sem id", "--expressa", "--porque", "y"], "agente", { marcador: "ia:teste\n", env: {} })).codigo, 0);
  const antigo = A.ledger().find((e) => e.no === "dentro-sem-id");
  assert.equal(antigo.sandbox, "sessao"); assert.equal("sessao" in antigo, false, "marcador sem id: sem vínculo");
  assert.equal((await A.z(["novo", "lixo no marcador", "--expressa", "--porque", "y"], "agente", { marcador: "ia:teste ../../x", env: {} })).codigo, 0);
  assert.equal("sessao" in A.ledger().find((e) => e.no === "lixo-no-marcador"), false, "a 2ª palavra só vale com forma de id");

  // (d) o lançador grava no marcador o id do sessao.aberta, e o ato de dentro (com esse marcador) o leva em sessao
  const B = await alvo();
  B.escrever(".agents/sistema.yaml", B.ler(".agents/sistema.yaml").replace(/^agentes:.*$/m, `agentes:\n  "ia:teste":\n    comando: [node]\n    hosts: [api.anthropic.com]`));
  let marcador = null;
  const executar = async (bin, args) => {
    const i = args.findIndex((x, k) => x === "/run/zeno-agente" && args[k - 2] === "--ro-bind");
    marcador = readFileSync(args[i - 1], "utf8");
    const r = await B.z(["novo", "feito na sessao", "--expressa", "--porque", "y"], "agente", { marcador, env: {} });
    return { status: r.codigo };
  };
  // a pasta da sessão no /tmp padrão: sob o TMPDIR fundo de um bench, o socket passaria dos 108 bytes do sun_path
  const s = await B.z(["sessao", "ia:teste", "--", "node", "-e", "0"], "agente", { env: { PATH: process.env.PATH }, executar });
  assert.equal(s.codigo, 0, s.stderr);
  // com uma pasta temporária funda, a sessão recusa antes do listen, sem abrir sessão e sem deixar pasta
  const funda = join(B.home, "x".repeat(100)); mkdirSync(funda);
  const antes = B.ledger().length;
  const rl = await B.z(["sessao", "ia:teste", "--", "node", "-e", "0"], "agente", { env: { PATH: process.env.PATH }, executar, tmp: funda });
  assert.equal(rl.codigo, 1); assert.match(rl.stdout + rl.stderr, /sessao.*108 bytes/); // o --json do z cai depois do --
  assert.deepEqual(readdirSync(funda), []); assert.equal(B.ledger().length, antes);
  const ab = B.ledger().find((e) => e.ev === "sessao.aberta");
  assert.equal(marcador, `ia:teste ${ab.id}\n`);
  assert.equal(ab.sandbox, "fora", "quem lança está fora");
  const criado = B.ledger().find((e) => e.ev === "no.criado" && e.no === "feito-na-sessao");
  assert.equal(criado.ator, "ia:teste"); assert.equal(criado.sandbox, "sessao"); assert.equal(criado.sessao, ab.id);

  // (c) a marca está sob a assinatura: trocar fora por sessao num evento assinado de pessoa faz o validar acusar
  const C = await alvo();
  const m = await noM(C);
  assert.equal((await C.z(["avancar", m, "--ate", "fim", ...ESPEC_M])).codigo, 3);
  assert.equal((await C.z(["gate", m, "--aprovar", "--motivo", "ok"], "pessoa")).codigo, 0);
  assert.ok(!(await C.z(["validar"])).j.erros.some((e) => e.regra === "assinatura"));
  const linhas = ledgerTxt(C).split("\n");
  const k = linhas.findIndex((l) => l.includes('"assinatura"') && l.includes('"gate.decidido"'));
  assert.ok(k >= 0 && linhas[k].includes('"sandbox":"fora"'), "o evento assinado leva a marca");
  linhas[k] = linhas[k].replace('"sandbox":"fora"', '"sandbox":"sessao"');
  writeFileSync(C.caminho(".agents/ledger.jsonl"), linhas.join("\n"));
  assert.ok((await C.z(["validar"])).j.erros.some((e) => e.regra === "assinatura"), "a marca trocada quebra a assinatura");

  // (e) ledger antigo, sem a marca: o validar segue limpo e o status lê
  const D = await alvo();
  await noP(D, "antes da marca");
  writeFileSync(D.caminho(".agents/ledger.jsonl"), ledgerTxt(D).replaceAll('"sandbox":"fora",', ""));
  assert.ok(!ledgerTxt(D).includes("sandbox"));
  const v = await D.z(["validar"]);
  assert.deepEqual(v.j.erros, [], JSON.stringify(v.j.erros));
  assert.equal((await D.z(["status", "antes-da-marca"])).codigo, 0);
});
