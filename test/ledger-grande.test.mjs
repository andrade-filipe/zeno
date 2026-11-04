// Append-only com arquivo acima de 1 MiB: o `git show` do ctx não pode cortar a saída (ENOBUFS), e um HEAD ilegível
// reprova em vez de pular o arquivo (achado no ledger do zeno/, 2026-11-04).
import { test } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { criarAlvo, gitReal } from "./ajuda.mjs";
import { appendOnly } from "../core/verbos/validar.mjs";

const cli = new URL("../cli.mjs", import.meta.url).pathname;

test("append-only: um fio acima de 1 MiB não reprova o acréscimo e segue pegando a edição", async () => {
  const A = await criarAlvo({ git: true }).pronto;
  assert.equal((await A.z(["novo", "Grande", "--expressa", "--porque", "teste"])).codigo, 0);
  const fio = A.caminho(".agents/trabalho/" + readdirSync(A.caminho(".agents/trabalho")).find((f) => f.endsWith(".fio.md")));
  appendFileSync(fio, Array.from({ length: 30000 }, (_, i) => `- linha ${i} ${"x".repeat(40)}`).join("\n") + "\n");
  gitReal(["add", "-A"], { cwd: A.dir });
  assert.equal(gitReal(["commit", "-q", "--no-verify", "-m", "grande"], { cwd: A.dir }).status, 0);
  const validar = () => {
    gitReal(["add", "-A"], { cwd: A.dir });
    // sem GIT_*: num commit de worktree o hook exporta GIT_DIR e GIT_INDEX_FILE, e o filho leria o repo de fora
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
    const r = spawnSync(process.execPath, [cli, "validar", "--staged"], { cwd: A.dir, encoding: "utf8", env: { ...env, HOME: A.home } });
    return r.stdout + r.stderr;
  };
  appendFileSync(fio, "- uma linha nova\n");
  assert.doesNotMatch(validar(), /append-only/, "acréscimo num arquivo grande passa");
  writeFileSync(fio, readFileSync(fio, "utf8").split("\n").slice(1).join("\n"));
  assert.match(validar(), /append-only/, "a 1ª linha tirada de um arquivo grande reprova");
});

test("append-only: o HEAD que o git não leu inteiro (status null) reprova, não pula", () => {
  const git = (args) => (args[0] === "ls-tree" ? { status: 0, stdout: "" } : args[1].startsWith("HEAD:") ? { status: null, stdout: "" } : { status: 0, stdout: "x\n" });
  const erros = appendOnly({ ctx: { git }, raiz: "/nao-importa" });
  assert.equal(erros.length, 1);
  assert.match(erros[0][3], /não pôde ser lida/);
});
