// promover.mjs — a cópia fixada do zeno (T68). O código que guarda (hooks, pre-commit, o shim da pessoa) roda de
// ~/.local/share/zeno/atual, nunca do repositório que o agente edita. Só uma pessoa promove, de uma árvore commitada,
// com testes e censo verdes; o evento é assinado. Uso: zeno promover [--de <dir do código do zeno>].
// T118: zeno promover --publicar <clone> roda a mesma prova e o portão de publicação (core/portao.mjs).
import { existsSync, mkdirSync, mkdtempSync, cpSync, renameSync, symlinkSync, readlinkSync, writeFileSync, lstatSync, rmSync, realpathSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { abrir, ev, gravar, exigirPessoa, exigirChaveConfigurada, abrirChaveDaPessoa, lerLedger } from "../sessao.mjs";
import { travar, destravar } from "../config.mjs";
import * as L from "../ledger.mjs";
import { lerNo, chaves } from "../no.mjs";
import { passouDaEntrega } from "../projecao.mjs";
import { Recusa } from "../util.mjs";
import { largura, cortar } from "../tela.mjs";
import { planoProva, comandoIsolado, aspas } from "../prova.mjs";
import { bpf } from "../seccomp.mjs";
import { modoRoot, raizEstranha, comandoTar, sha256Arquivo, assinarCopia, comandoInstalar } from "../root.mjs";
import { derivaDaFrota } from "../frota.mjs";
import { publicar, FORA } from "../portao.mjs";

export const CODIGO = ["cli.mjs", "core", "bin", "modulos", "test", "guardas.json"];
export const fixadoBase = (home) => join(home, ".local", "share", "zeno");
export const fixadoCli = (home) => join(fixadoBase(home), "atual", "cli.mjs");

export async function promover(ctx, pos, o, reg) {
  const S = reg(abrir(ctx, o, { escrever: false }));
  // T118: o --publicar é o portão de publicação; publicar é ato de pessoa (entrega.publicar é da faixa nunca)
  exigirPessoa(S, o.publicar ? "publicar o zeno" : "promover o zeno");
  if (o.publicar !== undefined && typeof o.publicar !== "string") throw new Recusa(2, "uso", "uso: zeno promover --publicar <dir do clone público> [--de dir]");
  exigirChaveConfigurada(S);
  const p = prepararPromover(S, o);
  // T72: a passphrase é conferida ANTES da prova (1–2 min de testes e censo), como na caixa --aprovar (T53)
  if (/*G:chave-antes-da-prova*/ true) await abrirChaveDaPessoa(S);
  if (o.publicar) return executarPublicar(S, p, resolve(ctx.cwd, o.publicar));
  return executarPromover(S, p);
}

// T118: a mesma prova e depois o portão; a cópia que guarda não muda
async function executarPublicar(S, { src, commit, nos }, pub) {
  if (S.trava) { gravar(S); destravar(S.trava); S.trava = null; }
  S.reprojetar();
  const pend = semEntrega(S, src, nos);
  if (pend.length) throw new Recusa(1, "promover", `a publicação traria código de nó sem a Entrega aprovada: ${pend.join(", ")}`);
  const prova = provar(S, src, commit);
  return publicar(S, { src, commit, prova, pub, lixo: join(fixadoBase(S.ctx.home), "_lixo") });
}

// T78: o que vem antes da passphrase (validação, commits e nós da cópia); a caixa --aprovar reusa, com a mesma chave
export function prepararPromover(S, o) {
  const ctx = S.ctx;
  const src = resolve(ctx.cwd, typeof o.de === "string" ? o.de : S.raiz);
  if (!existsSync(join(src, "cli.mjs")) || !existsSync(join(src, "core", "run.mjs"))) throw new Recusa(1, "promover", `${src} não é o código do zeno (falta cli.mjs ou core/run.mjs)`);
  const st = ctx.git(["status", "--porcelain", "--", ...CODIGO], { cwd: src });
  if (st.status !== 0) throw new Recusa(1, "promover", `não consegui ler o git de ${src}`);
  if (st.stdout.trim()) throw new Recusa(1, "promover", `há mudança não commitada no código; commite antes de promover:\n${st.stdout.trim()}`);
  if (o.publicar) { // o snapshot leva o zeno/ inteiro (menos o que fica fora), não só o código
    const t = ctx.git(["status", "--porcelain", "--untracked-files=all", "--", ".", ...[...FORA].map((x) => `:(exclude)${x}`)], { cwd: src });
    if (t.status !== 0 || t.stdout.trim()) throw new Recusa(1, "promover", `há mudança não commitada no zeno/; commite antes de publicar:\n${t.stdout.trim()}`);
  }
  const commit = ctx.git(["rev-parse", "HEAD"], { cwd: src }).stdout.trim();
  if (!/^[0-9a-f]{7,40}$/.test(commit)) throw new Recusa(1, "promover", "não achei o commit (git rev-parse HEAD)");
  // T95: com /opt/zeno do root, a cópia que guarda é a de lá; a da casa vira só área de preparo
  const root = modoRoot(ctx);
  if (!root && raizEstranha(ctx)) S.ctx.mostrar(`aviso: ${ctx.root.raiz} existe mas não é do root (ou é gravável por outros): sigo sem o modo root`);
  const base = fixadoBase(ctx.home), dest = join(base, commit.slice(0, 12)), atual = root ? root.atual : join(base, "atual");
  let anterior = existsSync(atual) ? basename(readlinkSync(atual)) : null;
  // T84: uma promoção que caiu depois de trocar o atual (sem evento) deixa o atual já no commit novo; o anterior de
  // verdade é o do último zeno.promovido deste ledger (no 9caeaf7, o evento gravou o próprio commit como anterior)
  if (anterior && commit.startsWith(anterior)) {
    const ult = (S.led?.eventos || []).filter((e) => e.ev === "zeno.promovido").at(-1)?.dados?.commit;
    if (ult && !commit.startsWith(ult.slice(0, 12))) { S.ctx.mostrar(`o atual já aponta para ${anterior} sem evento (promoção interrompida?): anterior = ${ult.slice(0, 12)}, do ledger`); anterior = ult.slice(0, 12); }
  }
  // T75: o que entra na cópia, em linguagem simples (assunto dos commits desde a cópia anterior), antes da passphrase
  // D40: uma linha por commit e por nó, cortada na largura do terminal
  const larg = largura(ctx);
  S.ctx.mostrar(commitsDesde(ctx, src, anterior, commit).split("\n").map((l) => cortar(l, larg)).join("\n"));
  // T76: os nós cuja ref entra nesta cópia; os de via expressa de código (sem gate humano) vêm marcados
  const nos = nosNaCopia(S, ctx, src, anterior, commit);
  if (nos.length) S.ctx.mostrar(`nós nesta cópia: ${nos.length}\n${nos.map((id) => cortar(`  ${id}${S.proj.nos.get(id)?.codigo ? " (expressa de código, sem gate)" : ""}`, larg)).join("\n")}`);
  const pend = semEntrega(S, src, nos, o.aprovando);
  if (pend.length) throw new Recusa(1, "promover", `a cópia traria código de nó sem a Entrega aprovada: ${pend.join(", ")}; aprove o gate de Entrega antes (zeno caixa --aprovar)`);
  const novo = !anterior || ctx.git(["diff", "--quiet", anterior, commit, "--", ...CODIGO], { cwd: src }).status !== 0;
  return { src, commit, base, dest, atual, anterior, nos, novo, root };
}

export async function executarPromover(S, { src, commit, base, dest, atual, anterior, nos, root }) {
  const ctx = S.ctx;
  if (S.trava) { gravar(S); destravar(S.trava); S.trava = null; }
  S.reprojetar();
  const pend = semEntrega(S, src, nos); // de novo antes da prova: os gates da mesma rodada já estão gravados
  if (pend.length) throw new Recusa(1, "promover", `a cópia traria código de nó sem a Entrega aprovada: ${pend.join(", ")}`);
  const prova = provar(S, src, commit);
  // cópia (não symlink) por commit; troca atômica do "atual"
  mkdirSync(base, { recursive: true });
  if (!existsSync(dest)) {
    const tmp = `${dest}.tmp`;
    if (existsSync(tmp)) renameSync(tmp, join(base, `_lixo-${commit.slice(0, 12)}-${ctx.agora()}`));
    mkdirSync(tmp, { recursive: true });
    for (const x of CODIGO) if (existsSync(join(src, x))) cpSync(join(src, x), join(tmp, x), { recursive: true, dereference: false });
    renameSync(tmp, dest);
  }
  return depoisDaCopia(S, { base, dest, atual, anterior, nos, root, src, commit, prova });
}

// a prova roda na árvore commitada, fora da trava. T90: toda ela num bwrap sem rede, sem a casa e com o repositório
// só leitura; nada roda fora (a sonda que cria bwrap aninha, porque o da prova não leva --disable-userns)
function provar(S, src, commit) {
  const ctx = S.ctx;
  const node = ctx.node || "node";
  const dir = mkdtempSync(join(ctx.tmp || "/tmp", "zeno-prova-"));
  let prova = "fora";
  try {
    const filtro = join(dir, "seccomp.bpf");
    writeFileSync(filtro, bpf(ctx.arch === "arm64" ? "arm64" : "x64"));
    const args = planoProva({ ctx, src, node });
    const isolado = (cmd) => (/*G:prova-isolada*/ true ? (prova = "bwrap", comandoIsolado(args, node, cmd, filtro)) : [node, ...cmd].map(aspas).join(" "));
    const caiu = (r) => (r.status === 127 ? " (ou falta o bwrap: instale o bubblewrap)" : "");
    S.ctx.mostrar(`promovendo ${commit.slice(0, 12)} de ${src}: testes num sandbox sem rede, sem a sua casa e com o repositório só leitura…`);
    const t = ctx.rodar(isolado(["--test", "test/*.test.mjs", "test/probes/*.test.mjs"]), { cwd: src });
    if (t.status !== 0) throw new Recusa(1, "promover", `os testes não passam${caiu(t)}: nada foi promovido`);
    S.ctx.mostrar("censo de mutação no sandbox (≈1–2 min)…");
    const c = ctx.rodar(isolado(["test/censo.mjs"]), { cwd: src });
    if (c.status !== 0) throw new Recusa(1, "promover", `o censo tem guarda viva sob mutação${caiu(c)}: nada foi promovido`);
  } finally { rmSync(dir, { recursive: true, force: true }); } // só a pasta do filtro, criada acima
  return prova;
}

async function depoisDaCopia(S, { base, dest, atual, anterior, nos, root, src, commit, prova }) {
  const ctx = S.ctx;
  if (root) return instalarComoRoot(S, { commit, dest, anterior, nos, prova, root });
  // T86: a troca do atual e do shim só fica se o evento assinado for gravado; qualquer falha até lá desfaz as duas
  const lixo = join(base, "_lixo"), alvoAntes = isLink(atual) ? readlinkSync(atual) : null;
  const shim = join(ctx.home, ".local", "bin", "zeno");
  let shimVelho = null, trocou = false, feito = null;
  try {
    trocarLink(base, atual, dest, ctx.agora()); trocou = true;
    // o shim da pessoa também sai do repositório: arquivo de verdade que roda a cópia fixada
    const alvoShim = /*G:copia-fixada*/ true ? fixadoCli(ctx.home) : join(src, "cli.mjs");
    mkdirSync(dirname(shim), { recursive: true });
    if (existsSync(shim) || isLink(shim)) { mkdirSync(lixo, { recursive: true }); shimVelho = join(lixo, `zeno-shim-${ctx.agora()}`); renameSync(shim, shimVelho); }
    writeFileSync(shim, `#!/bin/sh\n# GERADO pelo zeno promover: roda a cópia fixada, nunca o repositório que o agente edita (T68)\nexec node "${alvoShim}" "$@"\n`, { mode: 0o755 });
    // evento assinado no ledger do alvo (a chave já está aberta; com a guarda mutada, abre aqui, depois da prova)
    await abrirChaveDaPessoa(S);
    S.trava = travar(S.raiz, ctx.agora);
    lerLedger(S); S.reprojetar();
    ev(S, "zeno.promovido", null, { commit, anterior, copia: dest, testes: "ok", censo: "ok", nos, prova }, { assinar: true });
    const eventos = gravar(S);
    feito = { codigo: 0, msg: `zeno ${commit.slice(0, 12)} promovido: ${atual} → ${dest}\nshim: ${shim} (roda a cópia fixada)`, dados: { commit, copia: dest, anterior }, eventos };
  } catch (e) {
    if (trocou) desfazerTroca(ctx, { base, atual, alvoAntes, shim, shimVelho, lixo });
    throw e;
  }
  return comFrota(S, feito, dest);
}

// T106: a promoção já está feita e assinada; a conferência da frota vem depois, fora da trava (o sync de cada alvo trava
// o dele, e o próprio alvo do promover pode estar no registro). Nada aqui desfaz a promoção.
async function comFrota(S, feito, copia) {
  if (S.trava) { destravar(S.trava); S.trava = null; }
  S.ctx.mostrar(feito.msg); // a promoção primeiro; a frota mostra as linhas dela na hora, e o resumo fecha
  let f;
  try { f = await derivaDaFrota(S.ctx, copia); } catch (e) { f = { resumo: `frota: a conferência caiu (${e.message}); confira cada alvo com zeno sync --check`, dados: null }; }
  return { ...feito, msg: f.resumo, dados: { ...feito.dados, frota: f.dados } };
}

// T95: o modo root. A cópia provada (área de preparo na casa) vira um tar; a pessoa assina (commit, sha256) com a chave
// já aberta nesta rodada; o instalador root da cópia de lá confere os dois e troca o /opt/zeno/atual. O evento é gravado
// depois da troca (T86); se a gravação cair, o instalador volta o atual para a cópia anterior. O shim da casa sai do
// caminho, porque vem antes do /usr/local/bin no PATH.
async function instalarComoRoot(S, { commit, dest, anterior, nos, prova, root }) {
  const ctx = S.ctx, c12 = commit.slice(0, 12);
  // o instalador da cópia que está valendo, resolvido antes da troca: é ele que instala e, se cair, volta
  if (!existsSync(root.instalador)) throw new Recusa(1, "promover", `${root.raiz} é do root mas não tem ${root.instalador}: rode o bloco C do roteiro da T82`);
  root = { ...root, instalador: realpathSync(root.instalador) };
  const chave = await abrirChaveDaPessoa(S);
  const pac = mkdtempSync(join(ctx.tmp || "/tmp", "zeno-copia-"));
  try {
    const tar = join(pac, `zeno-${c12}.tar`), sig = join(pac, `zeno-${c12}.sig`);
    if (ctx.rodar(comandoTar(dest, tar), { cwd: pac }).status !== 0) throw new Recusa(1, "promover", "não consegui empacotar a cópia (tar): nada foi promovido");
    const sha = sha256Arquivo(tar);
    writeFileSync(sig, assinarCopia(chave, c12, sha));
    S.ctx.mostrar(`instalando ${c12} em ${root.raiz} pelo instalador root (${root.instalador}); o sudo pede a sua senha…`);
    const i = ctx.rodar(`${comandoInstalar(root, [c12, sha, tar, sig])} 2>&1`, { cwd: pac });
    if (i.status !== 0) throw new Recusa(1, "promover", `o instalador root não instalou (saída ${i.status}): nada foi promovido\n${String(i.stdout || "").trim()}`);
    const copia = join(root.raiz, c12);
    let eventos;
    try {
      S.trava = travar(S.raiz, ctx.agora);
      lerLedger(S); S.reprojetar();
      ev(S, "zeno.promovido", null, { commit, anterior, copia, testes: "ok", censo: "ok", nos, prova, root: true, sha256: sha }, { assinar: true });
      eventos = gravar(S);
    } catch (e) {
      const v = anterior ? ctx.rodar(`${comandoInstalar(root, ["--voltar", anterior])} 2>&1`, { cwd: pac }) : null;
      ctx.mostrar(v?.status === 0 ? `a promoção caiu antes do evento assinado: o ${root.atual} voltou para ${anterior}` : `a promoção caiu antes do evento assinado e o atual NÃO voltou${anterior ? ` (rode: sudo ${root.instalador} --voltar ${anterior})` : ""}`);
      throw e;
    }
    // o shim da casa vem antes no PATH e rodaria a cópia da casa: vai para o _lixo (nada é apagado)
    const shim = join(ctx.home, ".local", "bin", "zeno");
    let aviso = "";
    if (existsSync(shim) || isLink(shim)) {
      const lixo = join(fixadoBase(ctx.home), "_lixo");
      mkdirSync(lixo, { recursive: true });
      renameSync(shim, join(lixo, `zeno-shim-${ctx.agora()}`));
      aviso = `\naviso: o ${shim} foi para o _lixo; o zeno do PATH passa a ser o /usr/local/bin/zeno (roteiro da T82, bloco C)`;
    }
    return comFrota(S, { codigo: 0, msg: `zeno ${c12} promovido como root: ${root.atual} → ${copia}${aviso}`, dados: { commit, copia, anterior, root: true }, eventos }, copia);
  } finally { rmSync(pac, { recursive: true, force: true }); } // só a pasta do pacote, criada acima; o root guardou a cópia dele
}

function trocarLink(base, atual, alvo, ts) {
  const lk = join(base, `atual.${ts}`);
  if (existsSync(lk) || isLink(lk)) rmSync(lk);
  symlinkSync(alvo, lk);
  renameSync(lk, atual);
}

// T86: volta o atual para a cópia de antes (ou o tira para o _lixo, se não havia) e o shim de antes; nada é apagado
function desfazerTroca(ctx, { base, atual, alvoAntes, shim, shimVelho, lixo }) {
  mkdirSync(lixo, { recursive: true });
  if (alvoAntes) trocarLink(base, atual, alvoAntes, `${ctx.agora()}-volta`);
  else if (isLink(atual)) renameSync(atual, join(lixo, `atual-${ctx.agora()}`));
  if (existsSync(shim)) renameSync(shim, join(lixo, `zeno-shim-sem-evento-${ctx.agora()}`));
  if (shimVelho) renameSync(shimVelho, shim);
  ctx.mostrar(`a promoção caiu antes do evento assinado: o atual e o shim voltaram ao que eram${alvoAntes ? ` (${basename(alvoAntes)})` : ""}`);
}

export function commitsDesde(ctx, src, anterior, commit) {
  if (!anterior) return `primeira cópia fixada: entra ${commit.slice(0, 12)} inteiro`;
  if (commit.startsWith(anterior)) return `a cópia fixada já é ${anterior}: nenhum commit novo`;
  const r = ctx.git(["log", "--no-merges", "--format=%h %s", `${anterior}..${commit}`], { cwd: src });
  if (r.status !== 0) return `não consegui listar os commits desde ${anterior} (git log falhou): confira com git log ${anterior}..${commit.slice(0, 12)}`;
  const ls = r.stdout.split("\n").filter(Boolean);
  return `${ls.length} commit(s) desde a cópia ${anterior}:\n${ls.map((l) => "  " + l).join("\n")}`;
}

// T79: nó com ref na faixa cujo commit toca o código, que não passou da Entrega nem é expresso de código (T76). Git que
// falha conta como "toca" (fail-closed). `aprovando`: os gates de Entrega aprovados na mesma rodada da caixa (T78).
function semEntrega(S, src, nos, aprovando = new Set()) {
  const pre = S.ctx.git(["rev-parse", "--show-prefix"], { cwd: src }).stdout?.trim() || "";
  const toca = (ref) => {
    const r = S.ctx.git(["diff-tree", "--no-commit-id", "--name-only", "-r", "--root", ref], { cwd: src });
    return r.status !== 0 || r.stdout.split("\n").some((p) => p.startsWith(pre) && CODIGO.includes(p.slice(pre.length).split("/")[0]));
  };
  return /*G:promover-entrega*/ nos.filter((id) => {
    const st = S.proj.nos.get(id);
    return st && !st.codigo && !passouDaEntrega(st) && !aprovando.has(id) && toca(String(chaves(lerNo(S.raiz, id).secoes.out.entrega).ref).split(/\s/)[0]);
  });
}

// Nós do alvo com `- ref:` num commit entre a cópia anterior e a nova (para a avaliacao/ contar atos humanos por nó).
export function nosNaCopia(S, ctx, src, anterior, commit) {
  const r = ctx.git(["rev-list", anterior ? `${anterior}..${commit}` : commit], { cwd: src });
  if (r.status !== 0) return [];
  const revs = r.stdout.split("\n").filter(Boolean);
  const out = [];
  for (const st of S.proj.nos.values()) {
    let ref;
    try { ref = String(chaves(lerNo(S.raiz, st.id).secoes.out.entrega).ref || "").split(/\s/)[0]; } catch { continue; }
    if (/^[0-9a-f]{7,40}$/.test(ref) && revs.some((h) => h.startsWith(ref))) out.push(st.id);
  }
  return out.sort();
}

const isLink = (p) => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };
