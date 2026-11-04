// novo, validar, status, avancar + ledger.
import { test } from "node:test";
import assert from "node:assert/strict";
import { alvo, noP, noM, ESPEC_M, EXEC_ENTREGA } from "./ajuda.mjs";

test("novo P pela via expressa cria nó, vista e evento no.criado", async () => {
  const A = await alvo();
  const r = await A.z(["novo", "Corrigir o link", "--expressa", "--porque", "o link quebrou"]);
  assert.equal(r.codigo, 0, r.stderr + r.stdout);
  assert.equal(r.j.dados.id, "corrigir-o-link");
  assert.equal(r.j.dados.faixa_efetiva, "autonoma");
  const evs = A.ledger();
  assert.ok(evs.some((e) => e.ev === "no.criado" && e.no === "corrigir-o-link" && e.ator === "ia:claude"));
  assert.ok(evs.some((e) => e.ev === "artefato.escrito" && e.dados.fase === "intencao"));
  const txt = A.no("corrigir-o-link");
  assert.match(txt, /^---\nzeno: 1\nid: corrigir-o-link/);
  assert.match(txt, /fase: intencao/);
  assert.match(txt, /- porque: o link quebrou/);
  assert.ok(A.existe(".agents/trabalho/corrigir-o-link.fio.md"));
});

test("novo: id repetido ganha sufixo; uso errado sai com 2", async () => {
  const A = await alvo();
  assert.equal(await noP(A, "Mesma coisa"), "mesma-coisa");
  assert.equal(await noP(A, "Mesma coisa"), "mesma-coisa-2");
  assert.equal((await A.z(["novo", "sem tamanho"])).codigo, 2);
  assert.equal((await A.z(["novo", "x", "--expressa"])).codigo, 2);
  assert.equal((await A.z(["novo", "x", "--tamanho", "M", "--expressa", "--porque", "p"])).codigo, 2);
});

test("novo: pai inexistente, ação desconhecida e check desconhecido são recusados com 1", async () => {
  const A = await alvo();
  assert.equal((await A.z(["novo", "x", "--tamanho", "P", "--pai", "nao-existe"])).codigo, 1);
  assert.equal((await A.z(["novo", "x", "--tamanho", "P", "--acao", "voar"])).codigo, 1);
  assert.equal((await A.z(["novo", "x", "--tamanho", "P", "--check", "nenhum"])).codigo, 1);
  const rec = A.ledger().filter((e) => e.ev === "recusa");
  assert.equal(rec.length, 3);
});

test("avancar P até o fim pela via expressa: checks, auto-preenchimento e fechado", async () => {
  const A = await alvo();
  const id = await noP(A);
  const r = await A.z(["avancar", id, "--ate", "fim", "--pronto", "o teste passa", "--feito", "mudei", "--evidencia", "ok", "--ref", "arquivo.md", "--desfazer", "mover para _lixo"]);
  assert.equal(r.codigo, 0, r.stderr + r.stdout);
  assert.equal(r.j.dados.fase, "fechado");
  const evs = A.ledger().filter((e) => e.no === id);
  assert.equal(evs.filter((e) => e.ev === "fase.avancou").length, 7);
  assert.ok(evs.every((e, i) => i === 0 || evs[i - 1].ts < e.ts), "ts estritamente crescente");
  assert.match(A.no(id), /- observado: sem janela/);
  assert.match(A.no(id), /- atrito: nenhum/);
  assert.match(A.no(id), /estado: fechado/);
});

test("avancar com chave faltando registra artefato.incompleto e sai com 1", async () => {
  const A = await alvo();
  const id = await noP(A);
  const r = await A.z(["avancar", id, "--ate", "fim"]);
  assert.equal(r.codigo, 1);
  assert.ok(A.ledger().some((e) => e.ev === "artefato.incompleto" && e.dados.faltando.includes("pronto")));
});

test("check que falha reprova o gate da Verificação", async () => {
  const A = await alvo();
  const id = await noP(A, "Com check", ["--check", "falha"]);
  const r = await A.z(["avancar", id, "--ate", "fim", "--pronto", "p", "--feito", "f", "--evidencia", "e"]);
  assert.equal(r.codigo, 1);
  const g = A.ledger().find((e) => e.ev === "gate.decidido" && e.dados.fase === "verificacao");
  assert.equal(g.dados.decisao, "reprovado");
  assert.equal(g.dados.evidencia.checks[0].exit, 1);
});

test("chave de fase já passada é recusada", async () => {
  const A = await alvo();
  const id = await noP(A);
  await A.z(["avancar", id, "--pronto", "p"]);
  const r = await A.z(["avancar", id, "--porque", "mudei de ideia"]);
  assert.equal(r.codigo, 1);
  assert.equal(r.j.erros[0].regra, "fase-passada");
});

test("M: agente abre o gate humano na Especificação (código 3)", async () => {
  const A = await alvo();
  const id = await noM(A);
  const r = await A.z(["avancar", id, "--ate", "fim", ...ESPEC_M]);
  assert.equal(r.codigo, 3, r.stdout);
  assert.equal(r.j.dados.estado, "em-gate");
  assert.ok(A.ledger().some((e) => e.ev === "gate.aberto" && e.dados.fase === "especificacao" && e.dados.pessoas.includes("ana")));
  const s = await A.z(["status", id]);
  assert.equal(s.codigo, 0);
});

test("filho aberto segura a Verificação do pai; depende_de segura a Especificação", async () => {
  const A = await alvo();
  const pai = await noP(A, "Pai");
  const filho = await noP(A, "Filho", ["--pai", pai]);
  const r = await A.z(["avancar", pai, "--ate", "fim", "--pronto", "p", "--feito", "f", "--evidencia", "e", "--ref", "r", "--desfazer", "d"]);
  assert.equal(r.codigo, 1);
  assert.equal(r.j.erros[0]?.regra ?? "filhos", "filhos");
  const dep = await noP(A, "Depende", ["--depende", filho]);
  const r2 = await A.z(["avancar", dep, "--porque", "x"]);
  assert.equal((await A.z(["avancar", dep])).codigo, 1);
});

test("status lista a árvore e validar passa num alvo limpo", async () => {
  const A = await alvo();
  const pai = await noP(A, "Pai");
  await noP(A, "Filho", ["--pai", pai]);
  const s = await A.cru(["status"]);
  assert.equal(s.codigo, 0);
  assert.match(s.stdout, /pai/);
  assert.match(s.stdout, /filho/);
  const v = await A.z(["validar"]);
  assert.equal(v.codigo, 0, JSON.stringify(v.j?.erros));
});

test("validar pega vista editada à mão em campo de controle e --reparar refaz", async () => {
  const A = await alvo();
  const id = await noP(A);
  const p = `.agents/trabalho/${id}.md`;
  A.escrever(p, A.ler(p).replace("faixa: autonoma", "faixa: nunca"));
  const v = await A.z(["validar"]);
  assert.equal(v.codigo, 1);
  const r = await A.z(["validar", "--reparar"]);
  assert.equal(r.codigo, 0, JSON.stringify(r.j?.erros));
  assert.match(A.ler(p), /faixa: autonoma/);
});

test("P com commit: acima de P_linhas reprova a Entrega; linhas em .agents/ não contam (T65)", async () => {
  const { gitReal } = await import("./ajuda.mjs");
  const A = await alvo({ git: true });
  const id = await noP(A);
  gitReal(["add", "-A"], { cwd: A.dir }); gitReal(["commit", "-qm", "base"], { cwd: A.dir });
  A.escrever("pequeno.md", "x\n".repeat(10));
  await noP(A, "Outro nó só para encher o .agents");
  gitReal(["add", "-A"], { cwd: A.dir }); gitReal(["commit", "-qm", "pequeno"], { cwd: A.dir });
  const sha = gitReal(["rev-parse", "--short", "HEAD"], { cwd: A.dir }).stdout.trim();
  const r = await A.z(["avancar", id, "--ate", "fim", "--pronto", "p", "--feito", "f", "--evidencia", "e", "--ref", sha, "--desfazer", "git revert"]);
  assert.equal(r.codigo, 0, r.stdout);
  const id2 = await noP(A, "Grande");
  A.escrever("grande.md", "x\n".repeat(81));
  gitReal(["add", "-A"], { cwd: A.dir }); gitReal(["commit", "-qm", "grande"], { cwd: A.dir });
  const sha2 = gitReal(["rev-parse", "--short", "HEAD"], { cwd: A.dir }).stdout.trim();
  const r2 = await A.z(["avancar", id2, "--ate", "fim", "--pronto", "p", "--feito", "f", "--evidencia", "e", "--ref", sha2, "--desfazer", "git revert"]);
  assert.equal(r2.codigo, 1);
  const g = A.ledger().filter((e) => e.no === id2 && e.ev === "gate.decidido" && e.dados.fase === "entrega").at(-1);
  assert.equal(g.dados.decisao, "reprovado");
});
