// o portão no zeno/ de verdade (T118, pronto 3): o snapshot real passa nos checks de texto e de lista com uma lista de
// nomes de fixture, numa casa temporária. A lista real é da máquina e nunca é lida aqui. Os nomes da fixture são
// montados na hora, para não estarem escritos em lugar nenhum do snapshot. O gitleaks, o clone e o root ficam para as
// sondas. Só roda no monorepo: no clone público não há docs/ ao lado.
// O montar tira o snapshot do HEAD (git archive), não da árvore de trabalho: um arquivo solto ou só no stage (o censo
// da avaliação põe o zeno/censo.md no stage) não entra (sonda portao-commit).
import { test } from "node:test"; import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { raizTmp, gitReal } from "./ajuda.mjs";
import { ZENO_DIR } from "../core/config.mjs";
import { montar, listar, checkNomes, checkCasa, checkLista, checkLayout, caminhoNomes, PUBLICOS } from "../core/portao.mjs";

const noMonorepo = existsSync(join(ZENO_DIR, "..", "docs", "comecar.md"));
const rodar = (cmd, { cwd }) => { const r = spawnSync("sh", ["-c", cmd], { cwd, encoding: "utf8" }); return { status: r.status ?? 1, stdout: r.stdout || "" }; };

test("portão real: o snapshot do zeno/ commitado passa nos checks nomes, casa e lista", { skip: !noMonorepo && "fora do monorepo" }, () => {
  const home = mkdtempSync(join(raizTmp(), "zeno-casa-")), snap = mkdtempSync(join(raizTmp(), "zeno-snap-"));
  mkdirSync(join(home, ".config", "zeno"), { recursive: true });
  writeFileSync(caminhoNomes(home), ["zz", "nome", "inventado"].join("-") + "\n" + ["cliente", "de", "fixture"].join("_") + "\n");
  const ctx = { home, git: gitReal, rodar, tmp: raizTmp(), agora: () => Date.now() };
  const faltam = montar(ctx, ZENO_DIR, snap, { commit: "HEAD" });
  const arquivos = listar(snap);
  for (const f of [...PUBLICOS, "docs/comecar.md", "cli.mjs", "core/portao.mjs"]) assert.ok(arquivos.includes(f), `entra ${f}`);
  assert.ok(!arquivos.some((f) => /^(\.agents|\.claude|_lixo|\.githooks)\/|^CLAUDE\.md$/.test(f)), "nada do alvo");
  for (const c of [checkNomes(ctx, snap, arquivos), checkCasa(ctx, snap, arquivos), checkLista(snap, arquivos, faltam), checkLayout(snap, arquivos)]) assert.ok(c.ok, `${c.id}: ${c.msg}`);
  // v0.1.2: a T119 da spec real descreve a troca e sai com o texto dela, sem ser trocada
  assert.match(readFileSync(join(snap, "spec", "decisoes-tecnicas.md"), "utf8"), /`\$CE\/zeno\/` por `\$CE\/`/);
});
