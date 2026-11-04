// tela (D40): quebra com recuo, corte por palavra, rótulos numa coluna, tabela; o tipo da mudança sai do diff do ref.
import { test } from "node:test"; import assert from "node:assert/strict";
import { quebrar, cortar, rotulado, tabela, estilo, largura } from "../core/tela.mjs";
import { tipoDaMudanca, nivelDoRisco, itensDoConferir, pedeOlho } from "../core/vista.mjs";

test("quebrar, cortar, rotulado e tabela", () => {
  const ls = quebrar("uma frase que não cabe numa linha estreita de vinte", 20, 4);
  assert.ok(ls.every((l) => l.length <= 20)); assert.ok(ls.slice(1).every((l) => l.startsWith("    ")));
  assert.ok(quebrar("x".repeat(50), 20, 2).every((l) => l.length <= 20), "palavra maior que a linha é cortada");
  assert.equal(cortar("O bloco do AGENTS.md só vale onde", 20), "O bloco do…", "não corta no meio da palavra");
  assert.ok(cortar("O bloco do AGENTS.md só vale onde", 20).length <= 20); assert.match(cortar("abc def ghi jkl mno", 12), /…$/);
  const r = rotulado([["Muda", "a"], ["Conferir", ["um", "dois"]]], 40);
  assert.deepEqual(r, ["   Muda      a", "   Conferir  1. um", "             2. dois"]);
  assert.deepEqual(tabela(["#", "gate"], [["1", "curto"], ["12", "um título bem mais longo do que cabe"]], 24), [" #   gate", " 1   curto", " 12  um título bem…"]);
  assert.equal(estilo({ cor: true }).vermelho("x"), "\x1b[31mx\x1b[39m"); assert.equal(estilo({ cor: true }, { json: true }).vermelho("x"), "x");
  assert.equal(estilo({}).negrito("x"), "x"); assert.equal(largura({ colunas: 300 }), 100); assert.equal(largura({ colunas: 0 }), 80);
});

test("nível, conferir e o que pede olho", () => {
  assert.deepEqual(nivelDoRisco("alto: a chave"), { nivel: "alto", texto: "a chave" });
  assert.deepEqual(nivelDoRisco("Baixo · nada"), { nivel: "baixo", texto: "nada" });
  assert.equal(nivelDoRisco("baixo, só teste").nivel, null);
  assert.deepEqual(itensDoConferir("(1) a; (2) b c; (3) d"), ["a", "b c", "d"]); assert.deepEqual(itensDoConferir("a; b"), ["a", "b"]);
  const v = { nivel: "baixo", tipo: "código", mudou: false };
  assert.equal(pedeOlho(v), false);
  for (const x of [{ nivel: "alto" }, { nivel: null }, { tipo: "segurança" }, { mudou: true }]) assert.equal(pedeOlho({ ...v, ...x }), true, JSON.stringify(x));
});

test("tipo da mudança pelo diff do ref", () => {
  const arqs = { aaaaaaa: ["spec/cli.md", ".agents/ledger.jsonl"], bbbbbbb: ["core/run.mjs"], ccccccc: ["core/verbos/escrita.mjs"], ddddddd: ["guardas.json"], eeeeeee: [".agents/trabalho/x.md"] };
  const diffs = { ccccccc: "+  if (/*G:nova-guarda*/ x) y();\n" };
  const S = { raiz: "/x", ctx: { git: (a) => a.includes("--name-only") ? (arqs[a.at(-1)] ? { status: 0, stdout: arqs[a.at(-1)].join("\n") } : { status: 128, stdout: "" }) : { status: 0, stdout: diffs[a.at(-1)] || "" } } };
  const n = (ref) => ({ secoes: { out: { entrega: `- ref: ${ref}\n` } } });
  assert.equal(tipoDaMudanca(S, n("aaaaaaa"), "entrega"), "docs");
  assert.equal(tipoDaMudanca(S, n("aaaaaaa; bbbbbbb"), "entrega"), "código");
  assert.equal(tipoDaMudanca(S, n("ccccccc"), "entrega"), "segurança", "uma guarda /*G:*/ nova no diff");
  assert.equal(tipoDaMudanca(S, n("ddddddd"), "entrega"), "segurança");
  assert.equal(tipoDaMudanca(S, n("eeeeeee"), "entrega"), "registro", "só nós do .agents/");
  assert.equal(tipoDaMudanca(S, n("r"), "entrega"), "registro"); assert.equal(tipoDaMudanca(S, n("bbbbbbb"), "especificacao"), "registro");
  assert.equal(tipoDaMudanca(S, n("fffffff"), "entrega"), "registro", "commit que o git não acha");
});
