// zeno vista --obsidian: o grafo de trabalho do alvo como notas com links de wiki, numa pasta visível e fora do git, com
// cabeçalho de gerado e checagem de deriva; a nota de pessoa nunca é sobrescrita e o que sai vai para _lixo/.
import { test } from "node:test"; import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { alvo, noP, noM } from "./ajuda.mjs";
import { modeloGrafo } from "../core/grafo.mjs";

test("vista --obsidian: uma nota por nó, com pai, tags e cabeçalho; deriva, saída, nota de pessoa e _lixo", async () => {
  const A = await alvo();
  const pai = await noM(A, "O pai");
  const filho = await noP(A, "O filho", ["--pai", pai]);
  assert.equal((await A.z(["avancar", filho, "--pronto", `combina com ${pai}`])).codigo, 0);
  const g = await A.z(["vista", "--obsidian"]);
  assert.equal(g.codigo, 0, g.stderr);
  const dir = A.caminho("zeno-grafo"), ler = (n) => readFileSync(join(dir, n), "utf8");
  assert.deepEqual(readdirSync(dir).filter((n) => n.endsWith(".md")).sort(), ["_indice.md", `${filho}.md`, `${pai}.md`].sort());
  assert.equal(ler(".gitignore").split("\n").filter((l) => l && !l.startsWith("#")).join(), "*", "a pasta fica fora do git");
  const nf = ler(`${filho}.md`);
  assert.match(nf, /^---\ngerado_por: zeno vista --obsidian\nfonte: \.agents\/ledger\.jsonl\nledger_ultimo: [0-9a-z]+-[0-9a-f]{8}\n/);
  assert.match(nf, /GERADO pelo zeno vista --obsidian; não edite/);
  assert.match(nf, /^tags: \[zeno\/fase\/[a-z]+, zeno\/tamanho\/P, zeno\/faixa\/\w+, zeno\/estado\/ativo\]$/m);
  assert.match(nf, /^aliases: \["O filho"\]$/m);
  assert.ok(nf.includes(`- pai: [[${pai}]]`) && nf.includes(`- cita: [[${pai}]]`), nf);
  assert.ok(nf.includes("## Intenção"), "o corpo do nó vem junto");
  assert.ok(ler(`${pai}.md`).includes(`- filhos: [[${filho}]]`) && ler(`${pai}.md`).includes("- pai: —"));
  assert.ok(ler("_indice.md").includes(`[[${pai}]]`) && !ler("_indice.md").includes(`[[${filho}]]`), "o índice lista só as raízes");
  // --check: 0 logo depois; 1 depois de um evento novo; 1 depois de uma nota editada (com o cabeçalho)
  assert.equal((await A.z(["vista", "--obsidian", "--check"])).codigo, 0);
  await noP(A, "Outro");
  const c1 = await A.z(["vista", "--obsidian", "--check"]);
  assert.equal(c1.codigo, 1); assert.ok(c1.j.dados.deriva.includes("outro.md"), JSON.stringify(c1.j.dados));
  assert.equal((await A.z(["vista", "--obsidian"])).codigo, 0);
  writeFileSync(join(dir, `${pai}.md`), ler(`${pai}.md`) + "editado à mão\n");
  const c2 = await A.z(["vista", "--obsidian", "--check"]);
  assert.equal(c2.codigo, 1); assert.deepEqual(c2.j.dados.deriva, [`${pai}.md`]);
  // a nota sem cabeçalho é de pessoa: não é sobrescrita, e a vista avisa
  writeFileSync(join(dir, "outro.md"), "minha nota\n");
  const p = await A.z(["vista", "--obsidian"]);
  assert.equal(p.codigo, 0); assert.equal(ler("outro.md"), "minha nota\n");
  assert.ok(p.j.avisos.some((a) => /outro\.md/.test(a.msg)));
  assert.ok(!ler(`${pai}.md`).includes("editado à mão"), "a nota gerada editada é regerada");
  // a nota gerada de um id que não existe mais vai para _lixo/, nunca é apagada
  writeFileSync(join(dir, "sumiu.md"), ler(`${pai}.md`));
  assert.equal((await A.z(["vista", "--obsidian", "--check"])).codigo, 1);
  assert.equal((await A.z(["vista", "--obsidian"])).codigo, 0);
  assert.ok(!existsSync(join(dir, "sumiu.md")) && existsSync(join(dir, "_lixo", "sumiu.md")));
  // --saida: dentro do alvo vale; fora dele, no .agents/ ou sem valor, recusa
  assert.equal((await A.z(["vista", "--obsidian", "--saida", A.caminho("outra")])).codigo, 0);
  assert.ok(existsSync(A.caminho("outra", `${pai}.md`)));
  for (const fora of [A.home, A.caminho(".."), A.caminho(".agents/grafo")]) assert.equal((await A.z(["vista", "--obsidian", "--saida", fora])).codigo, 1, fora);
  assert.equal((await A.z(["vista", "--obsidian", "--saida"])).codigo, 2);
  assert.equal((await A.z(["vista"])).codigo, 2, "sem --obsidian: uso");
  // um .gitignore que já estava na pasta e não é do Zeno não é mexido
  mkdirSync(A.caminho("dele")); writeFileSync(A.caminho("dele", ".gitignore"), "x\n");
  const d = await A.z(["vista", "--obsidian", "--saida", A.caminho("dele")]);
  assert.equal(d.codigo, 0); assert.equal(A.ler("dele/.gitignore"), "x\n"); assert.ok(d.j.avisos.some((a) => /gitignore/.test(a.msg)));
  // só lê: nenhum evento
  const n = A.ledger().length; await A.z(["vista", "--obsidian"]); assert.equal(A.ledger().length, n);
});

test("modeloGrafo é puro: pai de outro alvo sai como texto, e a dependência local vira aresta", () => {
  const st = (id, x = {}) => ({ id, pai: null, fase: "intencao", estado: "ativo", tamanho: "P", faixa: "autonoma", acoes: [], depende_de: [], ...x });
  const nos = new Map([["a", st("a", { pai: "outro:z", depende_de: ["b", "outro:y"] })], ["b", st("b")]]);
  const cfg = { acoes: {}, faixas: {} };
  const m = modeloGrafo(nos, cfg, new Map([["a", { titulo: "A", corpo: "ver b e ab" }]]));
  const a = m.nos.find((n) => n.id === "a");
  assert.equal(a.paiLocal, false); assert.deepEqual(a.depende, [{ id: "b", local: true }, { id: "outro:y", local: false }]);
  assert.deepEqual(a.cita, ["b"]); assert.deepEqual(m.raizes, ["a", "b"]);
});
