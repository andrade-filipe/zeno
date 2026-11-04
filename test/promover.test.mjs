// promover (T68): cópia fixada do zeno, só por pessoa, de árvore commitada com testes e censo verdes; shim fora do repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readlinkSync, lstatSync, symlinkSync, mkdirSync, renameSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { alvo, noP, noM, ESPEC_M, gitFalso, rodarOk } from "./ajuda.mjs";
import { ZENO_DIR } from "../core/config.mjs";
import { valida } from "../core/assinatura.mjs";
import { parseYaml } from "../core/yaml.mjs";
import { negarShell } from "../core/shell.mjs";

test("promover: pessoa promove; cópia por commit, atual atômico, shim fora do repo, evento assinado", async () => {
  const A = await alvo();
  // o shim antigo era um symlink para o repo: vai para o _lixo, não é apagado
  mkdirSync(join(A.home, ".local", "bin"), { recursive: true });
  symlinkSync(join(ZENO_DIR, "bin", "zeno"), join(A.home, ".local", "bin", "zeno"));
  const r = await A.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso(), rodar: rodarOk });
  assert.equal(r.codigo, 0, r.stdout + r.stderr);
  const base = join(A.home, ".local", "share", "zeno"), dest = join(base, "abcdef123456");
  assert.ok(existsSync(join(dest, "cli.mjs")) && existsSync(join(dest, "core", "shell.mjs")) && existsSync(join(dest, "modulos", "nucleo", "faixas.yaml")));
  assert.ok(!lstatSync(join(dest, "core")).isSymbolicLink(), "é cópia, não link para o repo");
  assert.ok(!existsSync(join(dest, ".agents")), "a cópia leva só código");
  assert.equal(readlinkSync(join(base, "atual")), dest);
  const shim = readFileSync(join(A.home, ".local", "bin", "zeno"), "utf8");
  assert.match(shim, /\.local\/share\/zeno\/atual\/cli\.mjs/);
  assert.ok(!shim.includes(ZENO_DIR), "o shim não roda o repositório");
  assert.ok(!lstatSync(join(A.home, ".local", "bin", "zeno")).isSymbolicLink());
  assert.ok(existsSync(join(base, "_lixo")), "o shim antigo foi para o _lixo");
  const e = A.ledger().find((x) => x.ev === "zeno.promovido");
  assert.equal(e.dados.commit, "abcdef1234567890abcd");
  assert.ok(valida(e, parseYaml(A.ler(".agents/sistema.yaml")).obj.pessoas));
  // promover de novo outro commit troca o atual e registra o anterior
  const r2 = await A.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso({ commit: "1111111111112222" }), rodar: rodarOk });
  assert.equal(r2.codigo, 0);
  assert.equal(readlinkSync(join(base, "atual")), join(base, "111111111111"));
  assert.equal(A.ledger().filter((x) => x.ev === "zeno.promovido").at(-1).dados.anterior, "abcdef123456");
});

test("promover (T84): promoção que caiu depois de trocar o atual não grava o próprio commit como anterior", async () => {
  const A = await alvo();
  assert.equal((await A.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso(), rodar: rodarOk })).codigo, 0);
  // a 2ª promoção caiu depois de trocar o atual, sem evento (como no 9caeaf7, antes da T72)
  const base = join(A.home, ".local", "share", "zeno"), novo = join(base, "111111111111");
  mkdirSync(novo, { recursive: true });
  renameSync(join(base, "atual"), join(base, "atual-velho")); symlinkSync(novo, join(base, "atual"));
  const r = await A.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso({ commit: "1111111111112222" }), rodar: rodarOk });
  assert.equal(r.codigo, 0, r.stdout);
  assert.equal(A.ledger().filter((x) => x.ev === "zeno.promovido").at(-1).dados.anterior, "abcdef123456");
});

test("promover (T86): se o evento assinado não é gravado, o atual e o shim voltam ao que eram", async () => {
  const A = await alvo();
  assert.equal((await A.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso(), rodar: rodarOk })).codigo, 0);
  const base = join(A.home, ".local", "share", "zeno"), shim = join(A.home, ".local", "bin", "zeno");
  const antes = readlinkSync(join(base, "atual")), shimAntes = readFileSync(shim, "utf8");
  // o ledger fica só-leitura durante a prova: a gravação do evento falha depois da troca
  const led = join(A.dir, ".agents", "ledger.jsonl");
  const r = await A.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso({ commit: "1111111111112222" }), rodar: () => { chmodSync(led, 0o444); return { status: 0, ms: 1, stdout: "" }; } });
  chmodSync(led, 0o644);
  assert.notEqual(r.codigo, 0);
  assert.equal(readlinkSync(join(base, "atual")), antes, "o atual voltou para a cópia anterior");
  assert.equal(readFileSync(shim, "utf8"), shimAntes, "o shim voltou");
  assert.equal(A.ledger().filter((x) => x.ev === "zeno.promovido").length, 1);
});

test("promover recusa: agente, árvore suja, testes ou censo vermelhos — e nada muda", async () => {
  const A = await alvo();
  const base = join(A.home, ".local", "share", "zeno");
  assert.equal((await A.z(["promover", "--de", ZENO_DIR], "agente", { git: gitFalso(), rodar: rodarOk })).codigo, 3);
  assert.equal((await A.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso({ sujo: " M core/shell.mjs\n" }), rodar: rodarOk })).codigo, 1);
  assert.equal((await A.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso(), rodar: () => ({ status: 1, ms: 1, stdout: "" }) })).codigo, 1);
  let n = 0;
  assert.equal((await A.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso(), rodar: () => ({ status: n++ ? 1 : 0, ms: 1, stdout: "" }) })).codigo, 1, "censo vermelho");
  assert.ok(!existsSync(join(base, "atual")));
  assert.ok(!A.ledger().some((x) => x.ev === "zeno.promovido"));
  const B = await alvo({ chave: false });
  assert.equal((await B.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso(), rodar: rodarOk })).codigo, 1, "sem chave_pub");
});

test("promover (T75) mostra os commits desde a cópia anterior ANTES da passphrase", async () => {
  const A = await alvo();
  const visto = [];
  let antes = null;
  const sob = { mostrar: (t) => visto.push(t), segredo: async () => { antes ??= visto.join("\n"); return "passphrase-de-teste"; }, rodar: rodarOk };
  assert.equal((await A.z(["promover", "--de", ZENO_DIR], "pessoa", { ...sob, git: gitFalso() })).codigo, 0);
  assert.match(antes, /primeira cópia fixada/);
  visto.length = 0; antes = null;
  const r = await A.z(["promover", "--de", ZENO_DIR], "pessoa", { ...sob, git: gitFalso({ commit: "1111111111112222", log: "1111111 feat(zeno): cartão de decisão\n2222222 fix(zeno): FP4\n" }) });
  assert.equal(r.codigo, 0);
  assert.match(antes, /2 commit\(s\) desde a cópia abcdef123456:\n  1111111 feat\(zeno\): cartão de decisão\n  2222222 fix\(zeno\): FP4/);
});

test("promover (T76): zeno.promovido leva os nós com ref entre a cópia anterior e a nova", async () => {
  const A = await alvo();
  const fim = (ref) => ["--ate", "fim", "--pronto", "p", "--feito", "f", "--evidencia", "e", "--ref", ref, "--desfazer", `git revert ${ref}`];
  const dentro = await noP(A, "Dentro da copia"), fora = await noP(A, "Fora da copia");
  assert.equal((await A.z(["avancar", dentro, ...fim("1234abcd")])).codigo, 0);
  assert.equal((await A.z(["avancar", fora, ...fim("9999eeee")])).codigo, 0);
  const visto = [];
  const r = await A.z(["promover", "--de", ZENO_DIR], "pessoa", { mostrar: (t) => visto.push(t), rodar: rodarOk, git: gitFalso({ revs: "1234abcd00000000000000000000000000000000\nabcdef1234567890abcd\n" }) });
  assert.equal(r.codigo, 0, r.stdout);
  assert.deepEqual(A.ledger().find((x) => x.ev === "zeno.promovido").dados.nos, [dentro]);
  assert.ok(visto.some((t) => t.startsWith("nós nesta cópia: ") && t.includes(`\n  ${dentro}`)));
});

test("caixa --aprovar (T78): uma passphrase aprova os gates e promove; 'n' não promove; --promover sem perguntar", async () => {
  for (const [resp, flag, promove] of [["s", [], true], ["n", [], false], [null, ["--promover"], true]]) {
    const A = await alvo();
    const id = await noM(A);
    assert.equal((await A.z(["avancar", id, "--ate", "fim", ...ESPEC_M])).codigo, 3);
    A.responder("todos", ...(resp ? [resp] : []));
    const r = await A.z(["caixa", "--aprovar", "--de", ZENO_DIR, ...flag], "pessoa", { rodar: rodarOk, git: gitFalso({ log: "1111111 feat(zeno): x\n" }) });
    assert.equal(r.codigo, 0, r.stdout);
    assert.equal(A.segredos, 1, "uma passphrase só");
    assert.ok(A.ledger().some((e) => e.ev === "gate.decidido" && e.no === id && e.dados.tipo === "humano"));
    assert.equal(A.ledger().some((e) => e.ev === "zeno.promovido"), promove, `${resp ?? flag}`);
  }
});

test("guarda de shell: promover é de pessoa; cópia fixada, shim e gerados não se escrevem por shell", () => {
  for (const [c, r] of Object.entries({
    "zeno promover": "pessoa", "node cli.mjs promover --de .": "pessoa",
    "rm ~/.local/bin/zeno": "arquivo-protegido", "ln -sf /x/cli.mjs ~/.local/bin/zeno": "arquivo-protegido",
    "cp core/shell.mjs ~/.local/share/zeno/atual/core/shell.mjs": "arquivo-protegido", "sed -i s/a/b/ $HOME/.local/share/zeno/atual/core/shell.mjs": "arquivo-protegido",
    "echo '{}' > .claude/settings.json": "arquivo-protegido", "printf x >> CLAUDE.md": "arquivo-protegido",
  })) assert.equal(negarShell(c), r, c);
  for (const c of ["cat ~/.local/bin/zeno", "ls -la ~/.local/share/zeno/", "cat .claude/settings.json", "head CLAUDE.md"]) assert.equal(negarShell(c), null, c);
});
