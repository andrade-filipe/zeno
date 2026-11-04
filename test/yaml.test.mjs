// yaml: o subconjunto copiado do hub (adaptado). Achado do dogfood: espaço antes de item com aspas em lista inline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYaml, dump } from "../core/yaml.mjs";

test("lista inline: itens com aspas depois da vírgula não levam o espaço", () => {
  const { obj, errs } = parseYaml('a: ["x", "y"]\nb: [p, q]\nc: ["x, y" , z]\nd: [\'u\', "v"]\n');
  assert.deepEqual(errs, []);
  assert.deepEqual(obj, { a: ["x", "y"], b: ["p", "q"], c: ["x, y", "z"], d: ["u", "v"] });
});

test("dump e parse ida e volta", () => {
  const o = { id: "a-b", lista: ["um", "dois: três", ""], n: 3, nada: null, sub: { k: "v #não é comentário" } };
  assert.deepEqual(parseYaml(dump(o)).obj, { ...o, n: "3" }, "o subconjunto lê número como texto; o core usa num()");
});

test("chave entre aspas (T73: pessoas em hash) — lê e volta", () => {
  const { obj, errs } = parseYaml('pessoas:\n  "h:1a2b3c4d":\n    chave_pub: null\npadrao:\n  dono: "h:1a2b3c4d"\n');
  assert.deepEqual(errs, []);
  assert.deepEqual(obj, { pessoas: { "h:1a2b3c4d": { chave_pub: null } }, padrao: { dono: "h:1a2b3c4d" } });
  assert.deepEqual(parseYaml(dump(obj)).obj, obj);
});
