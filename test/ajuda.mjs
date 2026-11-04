// ajuda.mjs — fixtures dos testes: um alvo temporário, uma pessoa de teste com chave de teste, e ctx injetados (T16).
// Nenhuma variável de ambiente liga "modo teste": o teste chama o core com o ctx que quiser.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { run } from "../core/run.mjs";
import { gerarPar } from "../core/assinatura.mjs";

export const PASS = "passphrase-de-teste";
const envGit = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
export const gitReal = (args, { cwd }) => {
  const r = spawnSync("git", ["-c", "user.name=Ana Teste", "-c", "user.email=ana@teste", "-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8", env: envGit });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
};

// Uma raiz temporária por processo de teste (o node --test roda cada arquivo num processo): tudo o que o teste cria fica
// sob ela, e ela é apagada no exit — só a do próprio processo, nunca a de outra execução (o /tmp encheu com ~30 mil pastas).
let RAIZ_TMP = null;
export function raizTmp() {
  if (!RAIZ_TMP) {
    RAIZ_TMP = mkdtempSync(join(tmpdir(), "zeno-teste-"));
    const raiz = RAIZ_TMP;
    process.on("exit", () => { try { rmSync(raiz, { recursive: true, force: true }); } catch {} });
  }
  return RAIZ_TMP;
}

export function criarAlvo({ chave = true, checks = true, git = false, extra = "", fronteira = null, antes = null } = {}) {
  const dir = mkdtempSync(join(raizTmp(), "zeno-alvo-")), home = mkdtempSync(join(raizTmp(), "zeno-home-"));
  if (git) gitReal(["init", "-q", "-b", "main"], { cwd: dir });
  let relogio = null, respostas = [], segredos = 0, entrada = "";
  const base = {
    cwd: dir, home, agora: () => relogio ?? Date.now(),
    perguntar: async () => respostas.shift() ?? "",
    segredo: async () => { segredos++; return PASS; },
    entrada: async () => entrada,
    git: (args, o) => (args[0] === "config" && args[1] === "user.email" ? { status: 0, stdout: "ana@teste\n" } : args[0] === "config" && args[1] === "user.name" ? { status: 0, stdout: "Ana Teste\n" } : gitReal(args, o)),
    rodar: (cmd, { cwd }) => { const t = Date.now(); const r = spawnSync("sh", ["-c", cmd], { cwd, encoding: "utf8" }); return { status: r.status ?? 1, ms: Date.now() - t, stdout: r.stdout || "" }; },
    which: () => false,
  };
  const ctxDe = (quem) => quem === "pessoa" ? { ...base, env: {}, isTTY: true } : quem === "sem-tty" ? { ...base, env: {}, isTTY: false } : { ...base, env: { CLAUDECODE: "1" }, isTTY: false };
  const A = {
    dir, home,
    ctx: ctxDe,
    async z(args, quem = "agente", over = {}) {
      const r = await run([...args, "--json"], { ...ctxDe(quem), ...over });
      let j = null; try { j = JSON.parse(r.stdout); } catch {}
      return { ...r, j };
    },
    async cru(args, quem = "agente", over = {}) { return run(args, { ...ctxDe(quem), ...over }); },
    relogio: (ms) => { relogio = ms; },
    responder: (...r) => { respostas.push(...r); },
    entrada: (s) => { entrada = s; },
    get segredos() { return segredos; },
    ledger: () => readFileSync(join(dir, ".agents", "ledger.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)),
    no: (id) => readFileSync(join(dir, ".agents", "trabalho", `${id}.md`), "utf8"),
    fio: (id) => readFileSync(join(dir, ".agents", "trabalho", `${id}.fio.md`), "utf8"),
    caminho: (...p) => join(dir, ...p),
    ler: (...p) => readFileSync(join(dir, ...p), "utf8"),
    escrever: (rel, txt) => writeFileSync(join(dir, rel), txt),
    existe: (...p) => existsSync(join(dir, ...p)),
  };
  A.pronto = (async () => {
    if (antes) antes(dir);   // um harness que já existia (adoção, T74)
    const r = await run(["install", dir, "--sem-sync", "--pessoa", "ana", ...(fronteira ? ["--fronteira", fronteira] : []), ...(antes ? ["--adocao"] : [])], ctxDe("agente"));
    if (r.codigo !== 0) throw new Error("install falhou: " + r.stderr);
    let sis = readFileSync(join(dir, ".agents", "sistema.yaml"), "utf8");
    if (chave) {
      const { pem, pub } = gerarPar(PASS);
      mkdirSync(join(home, ".config", "zeno"), { recursive: true });
      writeFileSync(join(home, ".config", "zeno", "ana.key"), pem);
      sis = sis.replace("chave_pub: null", `chave_pub: "${pub}"`);
      A.pub = pub;
    }
    if (checks) sis = sis.replace("checks: null", 'checks:\n  passa: "true"\n  falha: "false"');
    sis += extra;
    writeFileSync(join(dir, ".agents", "sistema.yaml"), sis);
    return A;
  })();
  return A;
}

export async function alvo(opts) { return criarAlvo(opts).pronto; }

// Atalhos comuns
export async function noP(A, titulo = "Tarefa pequena", extra = []) {
  const r = await A.z(["novo", titulo, "--expressa", "--porque", "teste", ...extra]);
  if (r.codigo !== 0) throw new Error("novo falhou: " + JSON.stringify(r.j?.erros));
  return r.j.dados.id;
}
export async function noM(A, titulo = "Tarefa média", extra = []) {
  const r = await A.z(["novo", titulo, "--tamanho", "M", "--porque", "teste", "--para", "o time", "--fora", "nada", ...extra]);
  if (r.codigo !== 0) throw new Error("novo M falhou: " + JSON.stringify(r.j?.erros));
  return r.j.dados.id;
}
// T75: o cartão de decisão que todo gate humano pede (vai para a fase do próximo gate humano)
export const CARTAO = ["--cartao-muda", "o arquivo de teste muda", "--cartao-porque", "o teste pede a mudança", "--cartao-risco", "baixo: só o teste",
  "--cartao-desfazer", "mover para _lixo", "--cartao-reprovar", "o arquivo fica como está", "--cartao-conferir", "(1) o arquivo; (2) o teste"];
export const ESPEC_M = ["--pronto", "o teste passa", "--restricoes", "nenhuma", "--riscos", "baixo", ...CARTAO];
export const EXEC_ENTREGA = ["--feito", "feito", "--evidencia", "node --test ok", "--pronto-confere", "pronto ↔ teste", "--ref", "arquivo.md", "--desfazer", "mover para _lixo", ...CARTAO];

// promover (T68): git e rodar falsos para provar o verbo sem árvore git nem testes reais
export const gitFalso = ({ sujo = "", commit = "abcdef1234567890abcd", log = null, revs = null } = {}) => (args) =>
  args[0] === "config" ? { status: 0, stdout: args[1] === "user.email" ? "ana@teste\n" : "Ana Teste\n" }
  : args[0] === "status" ? { status: 0, stdout: sujo }
  : args[0] === "log" && log !== null ? { status: 0, stdout: log }
  : args[0] === "rev-list" && revs !== null ? { status: 0, stdout: revs }
  : args[0] === "rev-parse" ? { status: 0, stdout: commit + "\n" } : { status: 1, stdout: "" };
export const rodarOk = () => ({ status: 0, ms: 1, stdout: "" });
