// probe prova-isolada (T90): o promover roda os testes e o censo inteiros num bwrap sem rede, com a casa em tmpfs e o
// repositório só leitura; nada roda fora (não há lista de exceção que o agente edite).
import { test } from "node:test"; import assert from "node:assert/strict";
import { alvo, gitFalso } from "../ajuda.mjs"; import { ZENO_DIR } from "../../core/config.mjs";
test("probe prova-isolada", async () => {
  const A = await alvo(), cmds = [];
  const r = await A.z(["promover", "--de", ZENO_DIR], "pessoa", { git: gitFalso(), node: "/opt/node/bin/node", rodar: (c) => { cmds.push(c); return { status: 0, ms: 1, stdout: "" }; } });
  assert.equal(r.codigo, 0);
  assert.equal(cmds.length, 2, "só duas rodadas: os testes e o censo, nenhuma fora");
  const [testes, censo] = cmds;
  for (const c of cmds) {
    assert.match(c, /^bwrap /, "a prova roda num bwrap");
    for (const f of ["--unshare-net", "--unshare-user", "--clearenv", "--cap-drop ALL", "--seccomp 3"]) assert.ok(c.includes(f), `falta ${f}`);
    assert.ok(c.includes(`--tmpfs ${A.home}`), "a casa é tmpfs");
    assert.ok(!c.includes(`--ro-bind ${A.home} `), "a casa não entra");
    assert.ok(!/--bind (?!-)/.test(c.replace(/--ro-bind/g, "")), "nada em escrita");
    assert.ok(c.includes(`--ro-bind ${ZENO_DIR} ${ZENO_DIR}`), "o código só leitura");
    assert.match(c, / 3< \S+seccomp\.bpf$/);
  }
  assert.match(testes, / --test 'test\/\*\.test\.mjs' 'test\/probes\/\*\.test\.mjs' 3</, "a suíte inteira, sem exceção");
  assert.match(censo, / test\/censo\.mjs 3</, "o censo inteiro, sem lista de ids");
  assert.equal(A.ledger().find((e) => e.ev === "zeno.promovido").dados.prova, "bwrap");
});
