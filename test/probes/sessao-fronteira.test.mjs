// probe sessao-fronteira (T82, camada A da D39): dentro do zeno sessao, as rotas diretas que a T80 achou falham — o env
// do Filipe, a casa dele, os ptys do host, o Windows, o 127.0.0.1 do host, a rede fora da allowlist, o vsock e o chaveiro
// do kernel, e escrever no controle do git; o marcador é o ator, e ZENO_ATOR não o troca. Roda o bwrap de verdade.
import { test } from "node:test"; import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process"; import { createServer } from "node:net";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs"; import { join } from "node:path"; import { homedir } from "node:os";
import { criarAlvo } from "../ajuda.mjs";

const CLI = new URL("../../cli.mjs", import.meta.url).pathname;
const tem = (b) => spawnSync("sh", ["-c", `command -v ${b}`]).status === 0;

const DENTRO = String.raw`
import { existsSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import { connect } from "node:net"; import { spawnSync } from "node:child_process"; import { join } from "node:path";
const [casaReal, porta] = process.argv.slice(2), r = {};
const tcp = (host, p, envio) => new Promise((ok) => { const s = connect(Number(p), host); let d = ""; const t = setTimeout(() => { s.destroy(); ok("tempo"); }, 3000);
  s.on("connect", () => { if (envio) s.write(envio); }); s.on("data", (x) => { d += x; if (!envio || d.includes("\r\n\r\n")) { clearTimeout(t); s.destroy(); ok(d); } });
  s.on("error", (e) => { clearTimeout(t); ok("erro " + e.code); }); });
r.env = ["WSL_INTEROP", "ZENO_SONDA", "CLAUDECODE"].map((k) => k + "=" + (process.env[k] ?? "-")).join(" ");
r.casa = existsSync(join(casaReal, ".config")) || existsSync(join(process.env.HOME, ".config/zeno/canario"));
r.pts = readdirSync("/dev/pts").filter((x) => x !== "ptmx");
r.windows = ["/init", "/run/WSL", "/mnt/c", "/dev/dxg"].filter((p) => existsSync(p));
r.exe = spawnSync("/mnt/c/Windows/System32/whoami.exe").error?.code ?? "rodou";
r.hostDireto = await tcp("127.0.0.1", porta);
r.proxyFora = (await tcp("127.0.0.1", 3128, "CONNECT nao.permitido.invalid:443 HTTP/1.1\r\n\r\n")).split("\r\n")[0];
r.proxyPrivado = (await tcp("127.0.0.1", 3128, "CONNECT localhost:" + porta + " HTTP/1.1\r\n\r\n")).split("\r\n")[0];
try { writeFileSync(".githooks/pre-commit", "#!/bin/sh\n"); r.githooks = "escreveu"; } catch (e) { r.githooks = e.code; }
try { writeFileSync("comum.txt", "ok"); r.repo = "escreveu"; } catch (e) { r.repo = e.code; }
r.marcador = readFileSync("/run/zeno-agente", "utf8").trim();
try { writeFileSync("/run/zeno-agente", "ana"); r.marcadorEscrito = "escreveu"; } catch (e) { r.marcadorEscrito = e.code; }
const py = spawnSync("python3", ["-c", "import socket,ctypes,json\nr={}\ntry:\n socket.socket(40,socket.SOCK_STREAM); r['vsock']='aberto'\nexcept OSError as e: r['vsock']=e.errno\nl=ctypes.CDLL(None,use_errno=True)\nx=l.syscall(250,0,-3,0)\nr['keyctl']='ok' if x>=0 else ctypes.get_errno()\nprint(json.dumps(r))"], { encoding: "utf8" });
Object.assign(r, JSON.parse(py.stdout || "{}"));
r.filtros = Number((readFileSync("/proc/self/status", "utf8").match(/^Seccomp_filters:\s+(\d+)/m) || [])[1] ?? -1);
r.zenoPessoa = spawnSync("zeno", ["novo", "x", "--expressa", "--porque", "y"], { env: { ...process.env, ZENO_ATOR: "ana" }, encoding: "utf8" }).status;
r.zenoAgente = spawnSync("zeno", ["novo", "feito na sessao", "--expressa", "--porque", "y"], { encoding: "utf8" }).status;
process.stdout.write("SONDA " + JSON.stringify(r) + "\n");
`;

test("probe sessao-fronteira", { skip: !tem("bwrap") && "sem bwrap nesta máquina" }, async () => {
  const A = await criarAlvo().pronto;
  const host = createServer((c) => c.end("oi")); await new Promise((ok) => host.listen(0, "127.0.0.1", ok));
  const porta = host.address().port;
  const sis = A.ler(".agents/sistema.yaml").replace(/^agentes:.*$/m, `agentes:\n  "ia:teste":\n    comando: [node]\n    hosts: [permitido.invalid, localhost]\n    portas: [443, ${porta}]\n    env: [WSL_INTEROP, ZENO_SONDA]`);
  A.escrever(".agents/sistema.yaml", sis);
  mkdirSync(A.caminho(".githooks")); A.escrever(".githooks/pre-commit", "#!/bin/sh\nexit 0\n");
  mkdirSync(join(A.home, ".config/zeno"), { recursive: true }); writeFileSync(join(A.home, ".config/zeno/canario"), "x");
  A.escrever("dentro.mjs", DENTRO);
  const t0 = Date.now();
  const filho = spawn(process.execPath, [CLI, "sessao", "ia:teste", "--", "node", A.caminho("dentro.mjs"), homedir(), String(porta)],
    { cwd: A.dir, env: { PATH: process.env.PATH, HOME: A.home, WSL_INTEROP: "/run/WSL/1_interop", ZENO_SONDA: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  let out = "", err = ""; filho.stdout.on("data", (d) => (out += d)); filho.stderr.on("data", (d) => (err += d));
  const codigo = await new Promise((ok) => filho.on("exit", ok));
  const ms = Date.now() - t0; host.close();
  const linha = out.split("\n").find((l) => l.startsWith("SONDA "));
  assert.ok(linha, `a sonda não rodou dentro da sessão (saída ${codigo}): ${out}\n${err}`);
  const r = JSON.parse(linha.slice(6));
  assert.equal(r.env, "WSL_INTEROP=- ZENO_SONDA=1 CLAUDECODE=-", "o env é só a allowlist, e o interop nunca entra");
  assert.equal(r.casa, false, "a casa do Filipe (e a do alvo) não aparece");
  assert.deepEqual(r.pts, [], "os ptys do host não aparecem");
  assert.deepEqual(r.windows, [], "sem /init, /run/WSL, /mnt/c nem /dev/dxg");
  assert.equal(r.exe, "ENOENT");
  assert.match(r.hostDireto, /^erro /, "o 127.0.0.1 do host não é alcançável");
  assert.match(r.proxyFora, / 403 /, "host fora da allowlist: o proxy nega");
  assert.match(r.proxyPrivado, / 403 /, "host permitido que resolve para endereço privado: o proxy nega");
  assert.match(String(r.githooks), /^E(ROFS|ACCES|PERM)$/, "o .githooks/ é só leitura dentro");
  assert.equal(r.repo, "escreveu", "o resto do repositório é de escrita");
  assert.match(r.marcador, /^ia:teste [0-9a-z]+-[0-9a-f]{8}$/, "o marcador leva o agente e o id do sessao.aberta (T105)"); assert.notEqual(r.marcadorEscrito, "escreveu");
  assert.equal(r.vsock, 1, "AF_VSOCK negado pelo seccomp (EPERM)"); assert.equal(r.keyctl, 1, "keyctl negado pelo seccomp (EPERM)");
  // T90: o filtro é da sessão, não herdado: dentro há um filtro a mais que nesta sonda (que pode rodar aninhada na prova
  // do promover, já sob o mesmo seccomp; sem esta conta, desligar o --seccomp da sessão passaria despercebido ali)
  const aqui = Number((readFileSync("/proc/self/status", "utf8").match(/^Seccomp_filters:\s+(\d+)/m) || [])[1] ?? -1);
  assert.ok(aqui >= 0 && r.filtros === aqui + 1, `a sessão põe o próprio filtro seccomp (aqui ${aqui}, dentro ${r.filtros})`);
  assert.equal(r.zenoPessoa, 1, "dentro da sessão, ZENO_ATOR=pessoa é recusado"); assert.equal(r.zenoAgente, 0);
  const led = A.ledger();
  const criado = led.find((e) => e.ev === "no.criado" && e.no === "feito-na-sessao");
  assert.equal(criado?.ator, "ia:teste", "o ledger leva o agente do marcador");
  const ab = led.find((e) => e.ev === "sessao.aberta"), fe = led.find((e) => e.ev === "sessao.fechada");
  assert.equal(r.marcador, `ia:teste ${ab?.id}`);
  assert.equal(criado.sandbox, "sessao"); assert.equal(criado.sessao, ab.id, "o ato de dentro leva o id do sessao.aberta (T105)");
  assert.equal(ab?.dados.agente, "ia:teste"); assert.equal(fe?.dados.codigo, 0); assert.ok(fe.dados.rede.negadas >= 2);
  assert.equal(codigo, 0, err);
  process.stdout.write(`# sessao-fronteira: sessão inteira em ${ms} ms\n`);
});

// T90: a prova do promover (planoProva) num bwrap de verdade: a casa, a chave e o 127.0.0.1 do host não aparecem, e o
// repositório não aceita escrita. Mora aqui porque cria um bwrap; na prova do promover, ela roda aninhada no da prova.
const PROVA = String.raw`
import { existsSync, writeFileSync } from "node:fs"; import { connect } from "node:net"; import { join } from "node:path";
const [casaReal, casaAlvo, porta] = process.argv.slice(2), r = {};
r.casa = [join(casaReal, ".config"), join(casaReal, ".ssh"), join(casaAlvo, ".config/zeno/canario")].filter((p) => existsSync(p));
try { writeFileSync("escrito-pela-prova.txt", "x"); r.repo = "escreveu"; } catch (e) { r.repo = e.code; }
r.host = await new Promise((ok) => { const s = connect(Number(porta), "127.0.0.1"); const t = setTimeout(() => { s.destroy(); ok("tempo"); }, 3000);
  s.on("data", () => { clearTimeout(t); s.destroy(); ok("alcançou"); }); s.on("error", (e) => { clearTimeout(t); ok("erro " + e.code); }); });
process.stdout.write("PROVA " + JSON.stringify(r) + "\n");
`;
test("a prova do promover roda sem a casa, sem a rede e sem escrever no repo", { skip: !tem("bwrap") && "sem bwrap nesta máquina" }, async () => {
  const { planoProva, comandoIsolado } = await import("../../core/prova.mjs");
  const { bpf } = await import("../../core/seccomp.mjs");
  const A = await criarAlvo().pronto;
  mkdirSync(join(A.home, ".config/zeno"), { recursive: true }); writeFileSync(join(A.home, ".config/zeno/canario"), "x");
  A.escrever("prova.mjs", PROVA);
  const filtro = A.caminho("seccomp.bpf"); writeFileSync(filtro, bpf(process.arch === "arm64" ? "arm64" : "x64"));
  const host = createServer((c) => c.end("oi")); await new Promise((ok) => host.listen(0, "127.0.0.1", ok));
  const git = (args, { cwd }) => { const x = spawnSync("git", args, { cwd, encoding: "utf8" }); return { status: x.status, stdout: x.stdout || "" }; };
  const args = planoProva({ ctx: { home: A.home, env: {}, git }, src: A.dir, node: process.execPath });
  const cmd = comandoIsolado(args, process.execPath, [A.caminho("prova.mjs"), homedir(), A.home, String(host.address().port)], filtro);
  const x = await new Promise((ok) => { const c = spawn("sh", ["-c", cmd], { cwd: A.dir }); let o = "", e = ""; c.stdout.on("data", (d) => (o += d)); c.stderr.on("data", (d) => (e += d)); c.on("exit", (s) => ok({ s, o, e })); });
  host.close();
  const linha = x.o.split("\n").find((l) => l.startsWith("PROVA "));
  assert.ok(linha, `a prova não rodou no bwrap (saída ${x.s}): ${x.o}\n${x.e}`);
  const r = JSON.parse(linha.slice(6));
  assert.deepEqual(r.casa, [], "nem a casa do Filipe nem a do alvo aparecem");
  assert.equal(r.repo, "EROFS", "o repositório é só leitura");
  assert.match(r.host, /^erro /, "o 127.0.0.1 do host não é alcançável");
});
