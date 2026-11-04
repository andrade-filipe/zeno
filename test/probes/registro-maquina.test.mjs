// probe registro-maquina (T104): o agente não edita os arquivos do registro de alvos da máquina — as regras por pasta
// (da pessoa) e a lista (só a CLI escreve). Edit/Write pelo hook pre-tool, inclusive por ~ e por symlink de dentro do
// alvo; o shell pela guarda de shell, que já fecha a pasta da cópia fixada. No modo root, as regras da raiz do root também.
import { test } from "node:test"; import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, symlinkSync, chmodSync } from "node:fs"; import { join } from "node:path";
import { alvo, raizTmp } from "../ajuda.mjs";
import { negarShell } from "../../core/shell.mjs";

test("probe registro-maquina", async () => {
  const A = await alvo();
  const pasta = join(A.home, ".local", "share", "zeno");
  mkdirSync(pasta, { recursive: true });
  const raizRoot = mkdtempSync(join(raizTmp(), "zeno-opt-")); chmodSync(raizRoot, 0o755);
  const root = { raiz: raizRoot, uid: process.getuid(), sudo: "" };
  const hook = async (tool_name, tool_input, over = {}) => {
    const r = await A.cru(["guarda", "pre-tool"], "agente", { entrada: async () => JSON.stringify({ cwd: A.dir, session_id: "s", tool_name, tool_input }), ...over });
    assert.equal(r.codigo, 0, r.stderr);
    return /"deny"/.test(r.stdout);
  };
  const casos = [
    ["Write", { file_path: join(pasta, "regras.yaml") }, true],
    ["Edit", { file_path: join(pasta, "regras.yaml") }, true],
    ["MultiEdit", { file_path: join(pasta, "alvos.json") }, true],
    ["Write", { file_path: "~/.local/share/zeno/regras.yaml" }, true],
    ["Write", { file_path: join(A.home, "livre.md") }, false],
    ["Write", { file_path: join(pasta, "outra-coisa.txt") }, false],
  ];
  for (const [t, i, nega] of casos) assert.equal(await hook(t, i), nega, `${t} ${JSON.stringify(i)}`);
  // um symlink dentro do alvo que aponta para as regras
  symlinkSync(pasta, join(A.dir, "atalho"));
  assert.equal(await hook("Write", { file_path: join(A.dir, "atalho", "regras.yaml") }), true, "symlink para as regras");
  // modo root: as regras da raiz do root também são do registro
  assert.equal(await hook("Write", { file_path: join(raizRoot, "regras.yaml") }, { root }), true, "regras do modo root");
  assert.equal(await hook("Write", { file_path: join(raizRoot, "regras.yaml") }), false, "sem modo root, a pasta é só uma pasta");
  assert.ok(A.ledger().filter((e) => e.ev === "recusa" && e.dados.regra === "arquivo-protegido").length >= 6);
  // shell: escrever nas regras por redirecionamento, sed -i, cp, tee e mv é negado
  for (const c of [`echo '"~/x/**": pessoal' >> ~/.local/share/zeno/regras.yaml`, "sed -i s/cliente/pessoal/ $HOME/.local/share/zeno/regras.yaml",
    "cp /tmp/r.yaml ~/.local/share/zeno/regras.yaml", "tee ~/.local/share/zeno/alvos.json < /tmp/a", "mv ~/.local/share/zeno/regras.yaml /tmp/"])
    assert.equal(negarShell(c), "arquivo-protegido", c);
});
