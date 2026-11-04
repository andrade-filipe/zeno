#!/usr/bin/env node
// cli.mjs — a única peça que toca o processo (argv, env, TTY, stdin, relógio, git, shell). O core recebe tudo por ctx (T16).
import { spawnSync, execFileSync, spawn } from "node:child_process";
import { readFileSync, openSync, closeSync } from "node:fs";
import { homedir } from "node:os";
import { createInterface } from "node:readline";
import { createServer, connect } from "node:net";
import { run } from "./core/run.mjs";

// T82: `zeno relay <porta> <socket> -- <comando> …` roda DENTRO do sandbox do zeno sessao (é processo, por isso mora aqui,
// T16). A rede do sandbox não tem saída: o relay escuta em 127.0.0.1:<porta> (o HTTPS_PROXY da sessão), repassa cada
// conexão ao socket Unix do proxy de fora, que confere a allowlist, roda o comando do agente e sai com o código dele.
if (process.argv[2] === "relay") {
  const [porta, sock, sep, ...cmd] = process.argv.slice(3);
  if (!porta || !sock || sep !== "--" || !cmd.length) { process.stderr.write("uso: zeno relay <porta> <socket> -- <comando> …\n"); process.exit(2); }
  const srv = createServer((c) => { const s = connect(sock); c.pipe(s); s.pipe(c); c.on("error", () => s.destroy()); s.on("error", () => c.destroy()); });
  srv.listen(Number(porta), "127.0.0.1", () => {
    const filho = spawn(cmd[0], cmd.slice(1), { stdio: "inherit" });
    for (const sinal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sinal, () => filho.kill(sinal));
    filho.on("error", (e) => { process.stderr.write(`zeno relay: ${e.message}\n`); process.exit(127); });
    filho.on("exit", (code) => { srv.close(); process.exit(code ?? 128); });
  });
} else await principal();
async function principal() {

const lerEntrada = () => new Promise((ok) => { let s = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (d) => (s += d)); process.stdin.on("end", () => ok(s)); });

function perguntar(q) {
  return new Promise((ok) => { const rl = createInterface({ input: process.stdin, output: process.stderr }); rl.question(q, (r) => { rl.close(); ok(r); }); });
}
// passphrase sem eco: modo raw no TTY
function segredo(q) {
  return new Promise((ok, falha) => {
    if (!process.stdin.isTTY) return falha(new Error("sem TTY"));
    process.stderr.write(q);
    const ent = process.stdin; let s = "";
    ent.setRawMode(true); ent.resume(); ent.setEncoding("utf8");
    const on = (ch) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") { ent.setRawMode(false); ent.pause(); ent.off("data", on); process.stderr.write("\n"); return ok(s); }
        if (c === "\u0003") { ent.setRawMode(false); process.stderr.write("\n"); process.exit(130); }
        if (c === "\u007f") s = s.slice(0, -1); else s += c;
      }
    };
    ent.on("data", on);
  });
}

// T82: o marcador do zeno sessao (só existe dentro do bwrap, em bind só-leitura) e a cadeia de processos acima deste.
const lerMarcador = () => { try { return readFileSync("/run/zeno-agente", "utf8"); } catch { return null; } };
function ancestrais() {
  const out = []; let pid = process.ppid;
  for (let i = 0; i < 64 && pid > 1; i++) {
    try {
      const st = readFileSync(`/proc/${pid}/stat`, "utf8"), fim = st.lastIndexOf(")");
      const argv = readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0").filter(Boolean);
      out.push({ pid, comm: st.slice(st.indexOf("(") + 1, fim), argv });
      pid = Number(st.slice(fim + 2).split(" ")[1]);
    } catch { break; }
  }
  return out;
}
const SEM_SAIDA = (/*G:ferramentas-sem-segredo*/ "ignore") || "inherit";
// T82: o zeno sessao lança o bwrap aqui (só o cli.mjs toca processo); o fd 3 do filho é o filtro seccomp.
const executar = (bin, args, { env, fd3 }) => new Promise((ok) => {
  const fd = fd3 ? openSync(fd3, "r") : null;
  const c = spawn(bin, args, { env, stdio: ["inherit", "inherit", "inherit", ...(fd !== null ? [fd] : [])] });
  c.on("error", (e) => { if (fd !== null) closeSync(fd); ok({ status: 127, erro: e.message }); });
  c.on("exit", (code, sinal) => { if (fd !== null) closeSync(fd); ok({ status: code ?? 128, sinal }); });
});

const ctx = {
  marcador: lerMarcador(), ancestrais, executar,
  cwd: process.cwd(),
  env: process.env,
  isTTY: !!(process.stdin.isTTY && process.stdout.isTTY),
  home: homedir(),
  agora: () => Date.now(), tmp: "/tmp", arch: process.arch, node: process.execPath,
  root: { raiz: "/opt/zeno", uid: 0, sudo: "sudo" }, // T95: o modo root liga só se /opt/zeno for do root (core/root.mjs)
  // D40: a largura e a cor da tela (a saída da pessoa vai para o stderr: mostrar); NO_COLOR desliga, TERM=dumb também
  colunas: process.stderr.columns || process.stdout.columns || 80,
  cor: !!(process.stderr.isTTY && process.stdout.isTTY) && !process.env.NO_COLOR && process.env.TERM !== "dumb",
  perguntar, segredo,
  mostrar: (t) => process.stderr.write(t + "\n"), // na hora: o verbo interativo mostra antes de perguntar
  entrada: lerEntrada,
  // maxBuffer: o padrão do Node é 1 MiB, e o ledger passa disso (ENOBUFS cortava o `git show` e o append-only)
  git: (args, { cwd }) => { const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 1 << 30 }); return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" }; },
  rodar: (cmd, { cwd }) => { const t = Date.now(); const r = spawnSync("sh", ["-c", cmd], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); return { status: r.status ?? 1, ms: Date.now() - t, stdout: r.stdout || "" }; },
  which: (bin) => { try { execFileSync("sh", ["-c", `command -v ${bin}`], { stdio: "ignore" }); return true; } catch { return false; } },
  // T107: o zeno ferramentas confere login e serviço por um comando de status da tabela fixa (core/ferramentas.mjs),
  // sem shell e com tempo-limite. A saída do filho é descartada: só o código de saída volta, e um token que o comando
  // imprima nunca chega ao agente. O padrão de um comando de terminal é imprimir no terminal; a guarda é que não imprima.
  sondar: (bin, args) => {
    if (!/^[a-z]{2,16}$/.test(bin)) return { status: null };
    const r = spawnSync(bin, args, { stdio: SEM_SAIDA, timeout: 5000, shell: false });
    return { status: r.error ? null : r.status };
  },
};

const r = await run(process.argv.slice(2), ctx);
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exitCode = r.codigo;
}
