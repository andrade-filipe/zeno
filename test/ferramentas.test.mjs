// T107: as ferramentas de terminal do SDLC — detectar, ensinar no contexto (cartão; skill sob demanda) e conferir
// presença e login sem ler segredo (zeno ferramentas).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { alvo, noM, raizTmp, gitReal, rodarOk } from "./ajuda.mjs";
import { FERRAMENTAS } from "../core/ferramentas.mjs";
import { ZENO_DIR } from "../core/config.mjs";

// Um PATH falso com executáveis vazios (a presença é procurada no PATH, sem shell).
function pathCom(...bins) {
  const d = mkdtempSync(join(raizTmp(), "zeno-bin-"));
  for (const b of bins) { writeFileSync(join(d, b), "#!/bin/sh\nexit 0\n"); chmodSync(join(d, b), 0o755); }
  return d;
}
// Um sondar falso que grava o que foi pedido e responde pela tabela.
function sondarFalso(resp = {}) {
  const pedidos = [];
  const f = (bin, args) => { pedidos.push([bin, ...args]); const k = `${bin} ${args[0]}`; return { status: k in resp ? resp[k] : 0 }; };
  f.pedidos = pedidos;
  return f;
}
async function alvoComRepo({ remoto = "git@github.com:ana/repo.git", docker = true, extra = "" } = {}) {
  const A = await alvo({ git: true, extra });
  if (remoto) gitReal(["remote", "add", "origin", remoto], { cwd: A.dir });
  if (docker) writeFileSync(join(A.dir, "Dockerfile"), "FROM scratch\n");
  return A;
}

test("zeno ferramentas --json: git, gh, docker e testes, com presente, login, serviço e avisos; nada gravado", async () => {
  const A = await alvoComRepo();
  const antes = A.ledger().length;
  const sondar = sondarFalso({ "gh auth": 0, "docker info": 1 });
  const r = await A.z(["ferramentas"], "agente", { env: { CLAUDECODE: "1", PATH: pathCom("git", "gh", "docker", "true") }, sondar });
  assert.equal(r.codigo, 0);
  const fs = Object.fromEntries(r.j.dados.ferramentas.map((f) => [f.nome, f]));
  assert.deepEqual(Object.keys(fs), ["git", "gh", "docker", "testes"]);
  for (const f of Object.values(fs)) { assert.equal(typeof f.presente, "boolean"); assert.ok(f.login); assert.ok(Array.isArray(f.avisos)); }
  assert.equal(fs.gh.login, "sim (github.com)");
  assert.equal(fs.docker.login, "não dá para saber sem ler segredo");
  assert.equal(fs.docker.servico, "parado");
  assert.equal(fs.git.login, "não se aplica (a credencial é do helper do git)");
  assert.equal(fs.testes.presente, false, "o check 'falha' roda false, que não está neste PATH");
  assert.deepEqual(sondar.pedidos, [["gh", "auth", "status", "--hostname", "github.com"], ["docker", "info"]], "só a tabela fixa");
  assert.ok(!sondar.pedidos.flat().some((a) => /token/i.test(a)));
  assert.equal(A.ledger().length, antes, "o verbo só lê");
  const texto = (await A.cru(["ferramentas"], "agente", { env: { CLAUDECODE: "1", PATH: pathCom("git") }, sondar: sondarFalso() })).stdout;
  assert.match(texto, /faltam: gh, docker, testes/);
  assert.doesNotMatch(texto + JSON.stringify(r.j), /licen/i, "nenhum aviso de licença em nenhum alvo");
});

test("ausente não é sondado; gitlab detectado pelo host do remoto; podman quando é ele que está no PATH", async () => {
  const A = await alvoComRepo({ remoto: "https://gitlab.empresa.com.br/time/repo.git" });
  const sondar = sondarFalso({ "glab auth": 1 });
  const r = await A.z(["ferramentas"], "agente", { env: { CLAUDECODE: "1", PATH: pathCom("git", "glab", "podman") }, sondar });
  const fs = Object.fromEntries(r.j.dados.ferramentas.map((f) => [f.nome, f]));
  assert.deepEqual(Object.keys(fs), ["git", "glab", "podman", "testes"]);
  assert.equal(fs.glab.login, "não (gitlab.empresa.com.br)");
  const B = await alvoComRepo();
  const s2 = sondarFalso();
  await B.z(["ferramentas"], "agente", { env: { CLAUDECODE: "1", PATH: pathCom("git") }, sondar: s2 });
  assert.deepEqual(s2.pedidos, [], "gh e docker ausentes: nada é rodado");
});

test("dentro do zeno sessao o login de fora não aparece: não confere e avisa", async () => {
  const A = await alvoComRepo({ docker: false });
  const sondar = sondarFalso();
  const r = await A.z(["ferramentas"], "agente", { env: { CLAUDECODE: "1", PATH: pathCom("git", "gh") }, sondar, marcador: { agente: "claude" } });
  const gh = r.j.dados.ferramentas.find((f) => f.nome === "gh");
  assert.equal(gh.login, "não conferido (dentro do sandbox)");
  assert.match(gh.avisos.join(), /zeno sessao/);
  assert.ok(!sondar.pedidos.some((p) => p[1] === "auth"));
});

test("a chave ferramentas: do sistema.yaml sobrescreve a detecção; nome desconhecido sai", async () => {
  const A = await alvoComRepo({ extra: "ferramentas: [glab, xpto]\n" });
  const r = await A.z(["ferramentas"], "agente", { env: { CLAUDECODE: "1" }, sondar: sondarFalso() });
  assert.deepEqual(r.j.dados.ferramentas.map((f) => f.nome), ["glab"]);
  assert.equal(r.j.dados.fonte, "sistema.yaml");
});

const vagas = (txt) => (txt.match(/^name: /gm) || []).length + (txt.match(/^## Ferramentas deste alvo/gm) || []).length;

test("contexto: o bloco das ferramentas entra na Execução, na Verificação e na Entrega, não na Intenção; no máximo 3 skills", async () => {
  const A = await alvoComRepo();
  const id = await noM(A);
  const over = { env: { CLAUDECODE: "1", PATH: pathCom("git", "gh", "docker") } };
  for (const fase of ["execucao", "verificacao", "entrega"]) {
    const sk = (await A.z(["contexto", id, "--fase", fase], "agente", over)).j.dados.camadas.skills;
    assert.match(sk, /## Ferramentas deste alvo \(git, gh, docker, testes\)/, fase);
    assert.match(sk, /\*\*gh\*\* \(GitHub\)/);
    assert.match(sk, /Guia completo: .*ferramentas\/containers\/SKILL\.md/);
    assert.doesNotMatch(sk, /## O que nunca fazer/, "a skill inteira não entra; só o cartão");
    assert.ok(vagas(sk) <= 3, `${fase}: ${vagas(sk)} skills`);
  }
  const intencao = (await A.z(["contexto", id, "--fase", "intencao"], "agente", over)).j.dados.camadas.skills;
  assert.doesNotMatch(intencao, /Ferramentas deste alvo/);
});

test("contexto: um alvo sem ferramenta detectada monta o mesmo contexto de hoje", async () => {
  const A = await alvo({ checks: false });
  const id = await noM(A);
  const sk = (await A.z(["contexto", id, "--fase", "execucao"])).j.dados.camadas.skills;
  assert.equal(sk, readFileSync(join(ZENO_DIR, "modulos", "nucleo", "skills", "zeno", "SKILL.md"), "utf8"));
});

test("cada ferramenta da tabela tem skill e cartão de até 5 linhas; a do docker fala da licença; o install não copia nenhuma", async () => {
  for (const s of new Set(Object.values(FERRAMENTAS).map((f) => f.skill))) {
    const d = join(ZENO_DIR, "modulos", "nucleo", "ferramentas", s);
    assert.ok(existsSync(join(d, "SKILL.md")), s);
    const linhas = readFileSync(join(d, "cartao.md"), "utf8").trim().split("\n").length;
    assert.ok(linhas <= 5, `${s}: cartão com ${linhas} linhas`);
  }
  assert.match(readFileSync(join(ZENO_DIR, "modulos", "nucleo", "ferramentas", "containers", "SKILL.md"), "utf8"), /Docker Desktop pode pedir licença/);
  const A = await alvoComRepo();
  // o rodar também é falso: a fumaça do hook roda o zeno do PATH, que não existe na prova do promover
  assert.equal((await A.z(["sync"], "agente", { which: () => true, rodar: rodarOk })).codigo, 0);
  const sks = readdirSync(join(A.dir, ".claude", "skills"));
  assert.ok(sks.length > 0);
  assert.ok(!sks.some((s) => /ferramenta|^zeno-(git|gh|glab|containers|testes)$/.test(s)), sks.join());
});

test("ajuda --json lista o verbo ferramentas, que não muda estado nem é de pessoa", async () => {
  const A = await alvo();
  const v = (await A.z(["ajuda"])).j.dados.verbos.find((x) => x.verbo === "ferramentas");
  assert.deepEqual([v.muda, v.pessoa], [false, false]);
});
