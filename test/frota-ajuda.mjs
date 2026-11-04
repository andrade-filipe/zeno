// frota-ajuda.mjs — o fixture da frota (T106): alvos de teste num registro de teste (HOME temporário), para os testes da
// deriva depois do promover e a sonda promover-so-pessoal. Não é arquivo de teste: o node --test não o roda sozinho.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { alvo, gitReal, gitFalso, rodarOk, raizTmp } from "./ajuda.mjs";
import { run } from "../core/run.mjs";
import { ZENO_DIR } from "../core/config.mjs";

// a impressão digital de um alvo: todo arquivo fora do .git, mais o .git/config e o HEAD
export function digital(dir) {
  const h = createHash("sha256");
  const andar = (d) => { for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const p = join(d, e.name); if (e.name === ".git") continue; if (e.isDirectory()) andar(p); else h.update(p + "\0" + readFileSync(p)); } };
  andar(dir);
  try { h.update(readFileSync(join(dir, ".git", "config"))); } catch {}
  h.update(gitReal(["rev-parse", "HEAD"], { cwd: dir }).stdout);
  return h.digest("hex");
}
export const head = (d) => gitReal(["rev-parse", "HEAD"], { cwd: d }).stdout.trim();
export const check = async (A, d) => run(["sync", "--check", "--json"], { ...A.ctx("agente"), cwd: d });

// a frota: o alvo A (pessoal, sem sync: deriva de segurança), um pessoal limpo, um pessoal só com deriva de forma, um
// cliente e um empresa com deriva; todos repos git com um commit, no mesmo HOME (o registro do A)
export async function montarFrota() {
  const A = await alvo({ git: true });
  gitReal(["add", "-A"], { cwd: A.dir }); gitReal(["commit", "-qm", "alvo"], { cwd: A.dir });
  const sync = { which: () => true, rodar: rodarOk };
  const novo = async (nome, extra = [], depois = null) => {
    const d = join(mkdtempSync(join(raizTmp(), "zeno-frota-")), nome);
    mkdirSync(d, { recursive: true }); gitReal(["init", "-q", "-b", "main"], { cwd: d });
    const r = await run(["install", d, "--sem-sync", "--pessoa", "ana", ...extra], { ...A.ctx("agente"), cwd: d });
    assert.equal(r.codigo, 0, r.stderr);
    if (depois) await depois(d);
    // o commit do fixture não passa pelo gate do alvo (que o sync ligou): ele rodaria o zeno da casa de quem roda o teste,
    // e a deixa do commit sem nó (T113) pararia o commit de um alvo recém-instalado quando quem roda é um agente
    gitReal(["add", "-A"], { cwd: d }); gitReal(["-c", "core.hooksPath=/dev/null", "commit", "-qm", "alvo"], { cwd: d });
    return realpathSync(d);
  };
  const limpo = await novo("limpo", [], async (d) => assert.equal((await run(["sync"], { ...A.ctx("agente"), ...sync, cwd: d })).codigo, 0));
  const forma = await novo("forma", [], async (d) => { assert.equal((await run(["sync"], { ...A.ctx("agente"), ...sync, cwd: d })).codigo, 0); writeFileSync(join(d, "CLAUDE.md"), "editado à mão\n"); });
  const cliente = await novo("cliente", ["--fronteira", "cliente"]);
  const empresa = await novo("empresa", ["--fronteira", "empresa"]);
  // o git do promover é falso só no código do zeno; nos alvos é o de verdade
  const git = (args, o) => (o?.cwd === ZENO_DIR ? gitFalso()(args) : gitReal(args, o));
  const promover = (resp) => { A.responder(resp); return A.z(["promover", "--de", ZENO_DIR], "pessoa", { git, ...sync }); };
  return { A, a: realpathSync(A.dir), limpo, forma, cliente, empresa, promover, git };
}
