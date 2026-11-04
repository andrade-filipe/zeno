// probe guarda-arquivo (T69): o hook pre-tool de Edit/Write nega o arquivo protegido, inclusive o de fora do alvo
// (negar_escrita com `..`), resolvido contra a raiz do checkout onde a sessão está: vale num worktree ligado também.
import { test } from "node:test"; import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, symlinkSync } from "node:fs"; import { join, resolve } from "node:path";
import { alvo, gitReal, raizTmp as tmpdir } from "../ajuda.mjs";
test("probe guarda-arquivo", async () => {
  const A = await alvo({ git: true });
  const fora = "fora-" + A.dir.split("/").pop();
  A.escrever(".agents/sistema.yaml", A.ler(".agents/sistema.yaml").replace("negar_escrita: []", `negar_escrita: ["../${fora}"]`));
  mkdirSync(resolve(A.dir, "..", fora), { recursive: true });
  const hook = async (raiz, tool_name, tool_input, cwd = raiz) => {
    const r = await A.cru(["guarda", "pre-tool"], "agente", { entrada: async () => JSON.stringify({ cwd, session_id: "s", tool_name, tool_input }) });
    assert.equal(r.codigo, 0, r.stderr);
    return /"deny"/.test(r.stdout);
  };
  const casos = (raiz) => [
    ["Edit", { file_path: join(raiz, ".agents/ledger.jsonl") }, true],
    ["Write", { file_path: join(raiz, ".agents/trabalho/x.fio.md") }, true],
    ["MultiEdit", { file_path: join(raiz, ".claude/settings.json") }, true],
    ["Write", { file_path: resolve(raiz, "..", fora, "a/b.md") }, true],
    ["Edit", { file_path: "CLAUDE.md" }, true],
    ["NotebookEdit", { notebook_path: resolve(raiz, "..", fora, "n.ipynb") }, true],
    ["Write", { file_path: join(raiz, "src/livre.mjs") }, false],
    ["Edit", { file_path: join(raiz, ".agents/trabalho/x.md") }, false],
  ];
  for (const [t, i, nega] of casos(A.dir)) assert.equal(await hook(A.dir, t, i), nega, `${t} ${JSON.stringify(i)}`);
  // symlink dentro do alvo apontando para o protegido de fora
  symlinkSync(resolve(A.dir, "..", fora), join(A.dir, "atalho"));
  assert.equal(await hook(A.dir, "Write", { file_path: join(A.dir, "atalho/x.md") }), true, "symlink para fora");
  const recusa = A.ledger().filter((e) => e.ev === "recusa" && e.dados.regra === "arquivo-protegido");
  assert.ok(recusa.length >= 7);
  // num worktree ligado, longe do original: a raiz é a do worktree
  gitReal(["add", "-A"], { cwd: A.dir }); gitReal(["commit", "-qm", "alvo"], { cwd: A.dir });
  const longe = mkdtempSync(join(tmpdir(), "zeno-longe-")), wt = join(longe, "wt");
  mkdirSync(join(longe, fora));
  assert.equal(gitReal(["worktree", "add", "-q", "-b", "probe-arq", wt], { cwd: A.dir }).status, 0);
  for (const [t, i, nega] of casos(wt)) assert.equal(await hook(wt, t, i), nega, `worktree: ${t} ${JSON.stringify(i)}`);
});
