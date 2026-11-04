// probe ferramentas-sem-segredo (T107): o zeno ferramentas confere login e serviço sem que um segredo chegue à saída.
// Roda o cli.mjs de verdade (o ctx.sondar é dele) com binários falsos no PATH que imprimem um token-marcador no stdout e
// no stderr e gravam os argumentos, e um HOME falso com o marcador em ~/.config/gh/hosts.yml e ~/.docker/config.json.
// O marcador não pode aparecer na saída (texto e JSON), nada é gravado no ledger e nenhum argumento pede token.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { alvo, raizTmp, gitReal } from "../ajuda.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "cli.mjs");
const MARCA = "gho_MARCADORDOSEGREDO0000000000000000";

test("probe ferramentas-sem-segredo: o token que o comando imprime não chega à saída do zeno", async () => {
  const A = await alvo({ git: true });
  gitReal(["remote", "add", "origin", "git@github.com:ana/repo.git"], { cwd: A.dir });
  writeFileSync(join(A.dir, "Dockerfile"), "FROM scratch\n");
  const bin = mkdtempSync(join(raizTmp(), "zeno-bin-falso-")), home = mkdtempSync(join(raizTmp(), "zeno-home-falso-"));
  const log = join(bin, "argumentos.log");
  for (const b of ["gh", "docker"]) {
    writeFileSync(join(bin, b), `#!/bin/sh\necho "${b} $*" >> "${log}"\necho "Token: ${MARCA}"\necho "${MARCA}" >&2\nexit 0\n`);
    chmodSync(join(bin, b), 0o755);
  }
  mkdirSync(join(home, ".config", "gh"), { recursive: true });
  writeFileSync(join(home, ".config", "gh", "hosts.yml"), `github.com:\n  oauth_token: ${MARCA}\n`);
  mkdirSync(join(home, ".docker"), { recursive: true });
  writeFileSync(join(home, ".docker", "config.json"), JSON.stringify({ auths: { "x": { auth: MARCA } } }));
  const antes = readFileSync(A.caminho(".agents", "ledger.jsonl"), "utf8");
  const env = { PATH: `${bin}:/usr/bin:/bin`, HOME: home, CLAUDECODE: "1" };
  const rodar = (...a) => spawnSync(process.execPath, [CLI, "ferramentas", ...a], { cwd: A.dir, env, encoding: "utf8", timeout: 30000 });
  const texto = rodar(), json = rodar("--json");
  for (const r of [texto, json]) {
    assert.equal(r.status, 0, r.stderr);
    assert.ok(!(r.stdout + r.stderr).includes(MARCA), "o token apareceu na saída do zeno");
  }
  const gh = JSON.parse(json.stdout).dados.ferramentas.find((f) => f.nome === "gh");
  assert.equal(gh.login, "sim (github.com)", "o binário falso foi mesmo chamado");
  assert.equal(readFileSync(A.caminho(".agents", "ledger.jsonl"), "utf8"), antes, "nada gravado no ledger");
  const args = existsSync(log) ? readFileSync(log, "utf8") : "";
  assert.match(args, /gh auth status --hostname github\.com/);
  assert.doesNotMatch(args, /token|show|password|senha|config get/i, "nenhum argumento pede token");
});
