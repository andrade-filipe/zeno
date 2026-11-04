// probe commit-sem-no (T113): o validar --staged, que o githook gerado já roda, para o commit de agente com arquivo fora
// de .agents/, sem evento novo de nó no ledger do índice e sem nó em Execução; a pessoa só leva o aviso. Git falso.
import { test } from "node:test";
import assert from "node:assert/strict";
import { alvo } from "../ajuda.mjs";

test("probe commit-sem-no: o agente para (1) com o retro; a pessoa passa (0) com o aviso", async () => {
  const A = await alvo();
  const led = A.ler(".agents/ledger.jsonl");
  const git = (args) => {
    const k = args.join(" ");
    if (args[0] === "config") return { status: 0, stdout: args[1] === "user.email" ? "ana@teste\n" : "Ana Teste\n" };
    if (k === "diff --cached --name-only --relative") return { status: 0, stdout: "src/a.mjs\n" };
    if (k === "show HEAD:./.agents/ledger.jsonl" || k === "show :./.agents/ledger.jsonl") return { status: 0, stdout: led };
    return { status: 1, stdout: "" };
  };
  const ag = await A.z(["validar", "--staged"], "agente", { git });
  assert.equal(ag.codigo, 1, "o commit de agente sem nó passou");
  assert.equal(ag.j.erros[0].regra, "sem-no");
  assert.match(ag.j.erros[0].msg, /zeno registrar ".*" --retro/);
  const pe = await A.z(["validar", "--staged"], "pessoa", { git });
  assert.equal(pe.codigo, 0);
  assert.ok(pe.j.avisos.some((a) => a.regra === "sem-no"));
});
