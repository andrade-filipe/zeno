// probe sessao-perfil (T82): o registro agentes: com perfil; o perfil nunca expõe a chave nem a casa do Filipe; o ator de
// um processo com TTY e o e-mail da pessoa não sai como ela se há uma CLI de agente acima (o achado do inventário, D39);
// e o marcador da sessão é o ator, sem troca por ZENO_ATOR.
import { test } from "node:test"; import assert from "node:assert/strict";
import { criarAlvo } from "../ajuda.mjs";
import { carregar } from "../../core/config.mjs";

const PERFIL = (extra = "") => `agentes:\n  "ia:teste":\n    comando: [node]\n    hosts: [api.anthropic.com]${extra}`;

test("probe sessao-perfil", async () => {
  const A = await criarAlvo().pronto;
  const sis = A.ler(".agents/sistema.yaml");
  A.escrever(".agents/sistema.yaml", sis.replace(/^agentes:.*$/m, PERFIL()));
  const cfg = carregar(A.dir);
  assert.deepEqual(cfg.agentes, ["ia:teste"]); assert.deepEqual(cfg.perfis["ia:teste"].hosts, ["api.anthropic.com"]);
  const env = { PATH: process.env.PATH };
  // o plano: rede isolada, seccomp, marcador, e a allowlist do perfil
  const p = await A.z(["sessao", "ia:teste", "--plano"], "agente", { env, executar: async () => ({ status: 0 }) });
  assert.equal(p.codigo, 0, p.stderr);
  for (const f of ["--unshare-net", "--disable-userns", "--new-session", "--clearenv", "--seccomp"]) assert.ok(p.j.dados.args.includes(f), f);
  assert.ok(p.j.dados.binds.some(([, , dst]) => dst === "/run/zeno-agente"));
  assert.deepEqual(p.j.dados.hosts, ["api.anthropic.com"]);
  assert.equal((await A.z(["sessao", "ia:nenhum", "--plano"], "agente", { env, executar: async () => ({ status: 0 }) })).codigo, 1, "agente sem perfil: recusa");
  // o perfil que pede a chave do Zeno, a casa ou o ~/.ssh é recusado
  for (const ruim of ["~/.config/zeno", "~/.ssh", "~", "/mnt/c/Users"]) {
    A.escrever(".agents/sistema.yaml", sis.replace(/^agentes:.*$/m, PERFIL(`\n    le: ["${ruim}"]`)));
    const r = await A.z(["sessao", "ia:teste", "--plano"], "agente", { env, executar: async () => ({ status: 0 }) });
    assert.equal(r.codigo, 1, `${ruim} passou`); assert.equal(r.j.erros[0].regra, "agente");
  }
  A.escrever(".agents/sistema.yaml", sis.replace(/^agentes:.*$/m, PERFIL()));
  // o ator: TTY + e-mail da pessoa, mas com um hermes acima, não é a pessoa
  const comPai = { ancestrais: () => [{ pid: 9, comm: "zsh", argv: ["zsh"] }, { pid: 8, comm: "hermes", argv: ["/opt/hermes/bin/hermes", "chat"] }] };
  assert.equal((await A.z(["novo", "com pai agente", "--expressa", "--porque", "y"], "pessoa", comPai)).codigo, 0);
  assert.equal(A.ledger().find((e) => e.no === "com-pai-agente").ator, "ia:desconhecido");
  const node = { ancestrais: () => [{ pid: 7, comm: "node", argv: ["node", "/x/lib/node_modules/@openai/codex/bin/codex.js"] }] };
  assert.equal((await A.z(["novo", "com codex acima", "--expressa", "--porque", "y"], "pessoa", node)).codigo, 0);
  assert.equal(A.ledger().find((e) => e.no === "com-codex-acima").ator, "ia:desconhecido");
  assert.equal((await A.z(["novo", "sem pai agente", "--expressa", "--porque", "y"], "pessoa", { ancestrais: () => [{ pid: 9, comm: "zsh", argv: ["-zsh"] }] })).codigo, 0);
  assert.equal(A.ledger().find((e) => e.no === "sem-pai-agente").ator, "ana", "no terminal da pessoa, segue a pessoa");
  // o marcador: é o ator, ZENO_ATOR não o troca, e verbo de pessoa é recusado
  const dentro = { marcador: "ia:teste\n", env: {} };
  assert.equal((await A.z(["novo", "no sandbox", "--expressa", "--porque", "y"], "agente", dentro)).codigo, 0);
  assert.equal(A.ledger().find((e) => e.no === "no-sandbox").ator, "ia:teste");
  const troca = await A.z(["novo", "troca", "--expressa", "--porque", "y"], "agente", { ...dentro, env: { ZENO_ATOR: "ana" } });
  assert.equal(troca.codigo, 1); assert.equal(troca.j.erros[0].regra, "ator");
  assert.equal((await A.z(["caixa", "--aprovar"], "pessoa", { marcador: "ia:teste" })).codigo, 3, "dentro da sessão, nem com TTY o verbo é de pessoa");
});
