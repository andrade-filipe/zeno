// sessao.mjs — uma chamada da CLI sobre um alvo: ator, trava, eventos em buffer, assinatura, gravação e vistas.
import { existsSync, readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { acharAlvo, carregar, travar, destravar, ehPessoa, P } from "./config.mjs";
import * as L from "./ledger.mjs";
import { projetar, faixaEfetiva } from "./projecao.mjs";
import { lerNo, gravarNo, caminhoFio, CONTROLE } from "./no.mjs";
import { formatar } from "./mensagens.mjs";
import { abrirChave, assinar, caminhoChave } from "./assinatura.mjs";
import { novoId, ehAgente, Recusa, sha256, lista } from "./util.mjs";
import { tradutor } from "./pessoas.mjs";

// Ator (T13). Filtro, não prova: a prova de pessoa é a assinatura.
// T82: dentro do zeno sessao, o marcador /run/zeno-agente (bind só-leitura que o lançador põe e o agente não cria) é o
// ator, e ZENO_ATOR não o troca. T105: um processo de fora, do mesmo uid, forja o marcador com um bwrap sem privilégio;
// ele é declaração, não prova. Fora dele, um processo com TTY e o e-mail do git da pessoa só sai como ela se nenhum
// ancestral for a CLI de um agente conhecido (o achado do inventário, D39: a ferramenta sem porta não vira o Filipe).
export const CLIS_DE_AGENTE = ["claude", "hermes", "codex", "gemini", "aider", "opencode", "goose", "cursor-agent", "qwen", "amp"];
export function nomesDeAgente(cfg) {
  const s = new Set(CLIS_DE_AGENTE);
  for (const p of Object.values(cfg.perfis || {})) { const c = lista(p?.comando)[0]; if (c) s.add(String(c).split("/").pop()); }
  return s;
}
export function paiAgente(ctx, cfg) {
  const nomes = nomesDeAgente(cfg), base = (x) => String(x || "").split("/").pop().replace(/\.(m?js|exe)$/, "");
  for (const a of (ctx.ancestrais ? ctx.ancestrais() : [])) {
    if ([a.comm, a.argv?.[0], a.argv?.[1]].some((x) => x && nomes.has(base(x)))) return base(a.comm || a.argv?.[0]);
  }
  return null;
}
export function resolverAtor(ctx, cfg) {
  const env = ctx.env || {};
  const m = typeof ctx.marcador === "string" ? ctx.marcador.trim().split(/\s+/)[0] : "";
  if (/*G:ator-marcador*/ m) {
    if (!ehAgente(m)) throw new Recusa(1, "ator", `marcador de sessão inválido: ${m}`);
    if (env.ZENO_ATOR && env.ZENO_ATOR !== m) throw new Recusa(1, "ator", `dentro da sessão de ${m}, ZENO_ATOR não troca o ator`);
    return m;
  }
  if (env.ZENO_ATOR) {
    if (/*G:ator-falso*/ env.CLAUDECODE && !ehAgente(env.ZENO_ATOR)) throw new Recusa(1, "ator", "agente não age como pessoa");
    return env.ZENO_ATOR;
  }
  if (env.CLAUDECODE) return "ia:claude";
  if (ctx.isTTY) {
    if (/*G:ator-pai-agente*/ paiAgente(ctx, cfg)) return "ia:desconhecido";
    const email = ctx.git(["config", "user.email"], { cwd: cfg.raiz }).stdout?.trim();
    const p = Object.entries(cfg.pessoas).find(([, v]) => (v?.git && v.git === email) || (v?.git_sha256 && email && v.git_sha256 === sha256(email)));
    if (p) return p[0];
  }
  return "ia:desconhecido";
}

// T105: a marca de sandbox de todo evento. Sem marcador, o ato foi de fora com certeza ("fora"); com ele, "sessao" é o que
// o marcador declara, e a 2ª palavra (o id do sessao.aberta que o lançador grava) liga o ato à sessão. Não é prova.
const ID_EVENTO = /^[0-9a-z]+-[0-9a-f]{8}$/;
export function marcaSandbox(ctx) {
  const [agente, sessao] = typeof ctx.marcador === "string" ? ctx.marcador.trim().split(/\s+/) : [];
  if (/*G:marca-sandbox*/ agente) return ID_EVENTO.test(sessao || "") ? { sandbox: "sessao", sessao } : { sandbox: "sessao" };
  return { sandbox: "fora" };
}

export function abrir(ctx, opts, { escrever = true } = {}) {
  const raiz = acharAlvo(ctx.cwd, opts.alvo);
  const cfg = carregar(raiz);
  const tr = tradutor(cfg, ctx.home);   // T73: fronteira empresa/cliente sem sal recusa aqui, antes de qualquer escrita
  tr.cfgDeDisco(cfg); cfg.disco = tr;
  const S = { tr, ctx, raiz, cfg, t0: ctx.agora(), cmd: novoId(ctx.agora()), buf: [], fios: [], nosEscritos: new Map(), tocados: new Set(), trava: null, chave: null };
  S.ator = resolverAtor(ctx, cfg);
  S.marca = marcaSandbox(ctx);
  if (escrever) {
    S.trava = travar(raiz, ctx.agora);
  }
  lerLedger(S);
  const ult = S.led.eventos.at(-1);
  S.ultimoMs = ult ? Date.parse(ult.ts) : 0;
  if (S.trava?.assumida) S.buf.push(base(S, "trava.assumida", null, S.trava.assumida));
  S.reprojetar = () => { S.proj = projetar([...S.led.eventos, ...S.buf].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : 1)), cfg); return S.proj; };
  S.reprojetar();
  return S;
}

// O ledger como a CLI o vê: as pessoas em claro (o disco pode estar em hash, T73).
export function lerLedger(S) { S.led = L.ler(S.raiz); for (const e of S.led.eventos) S.tr.deDisco(e); return S.led; }

function estratoDe(S, no, dados) {
  if (!no) return null;
  const st = S.proj?.nos.get(no);
  const src = st || dados || {};
  const fm = S.nosEscritos.get(no)?.fm || lerNo(S.raiz, no)?.fm || {};
  return { tipo: src.tipo, tamanho: src.tamanho, faixa: st ? faixaEfetiva(st, S.proj.nos, S.cfg) : src.faixa, modulo: fm.modulo || "nucleo", expressa: !!src.expressa };
}

// ts estritamente crescente dentro da chamada: a ordem (ts, id) do ledger é a ordem dos fatos.
function base(S, ev, no, dados, extra = {}) {
  const ms = Math.max(S.ctx.agora(), (S.ultimoMs ?? 0) + 1);
  S.ultimoMs = ms;
  const ts = new Date(ms).toISOString();
  return { v: L.V, id: novoId(ms), ts, ev, alvo: S.cfg.alvo, no, ator: S.ator, estrato: null, dur_ms: 0, cmd: S.cmd, config_sha256: S.cfg.config_sha256, ...S.marca, ...extra, dados };
}

// Acrescenta um evento ao buffer. opts.assinar: assina já (a chave da pessoa foi aberta nesta chamada).
export function ev(S, nome, no, dados = {}, opts = {}) {
  const e = base(S, nome, no, dados, S.retro ? { ...S.retro } : {});
  e.estrato = estratoDe(S, no, nome === "no.criado" ? dados : null);
  if (opts.assinar) { e.dur_ms = S.ctx.agora() - S.t0; assinar(e, S.ator, exigirChave(S), S.tr.paraDisco); }
  S.buf.push(e);
  if (no) S.tocados.add(no);
  S.reprojetar();
  return e;
}

export function exigirPessoa(S, oQue) {
  const env = S.ctx.env || {};
  if (!S.ctx.isTTY || env.CLAUDECODE || S.ctx.marcador || !ehPessoa(S.cfg, S.ator)) throw new Recusa(3, "pessoa", `${oQue} é de pessoa, no terminal dela, fora do Claude Code`);
}
// Antes de pedir passphrase ou escolha: a chave tem de estar configurada (arquivo + chave_pub no sistema.yaml).
export function exigirChaveConfigurada(S) {
  if (!S.cfg.pessoas[S.ator]?.chave_pub) throw new Recusa(1, "assinatura", `sistema.yaml não tem chave_pub de ${S.ator}: cole a que o zeno chave nova imprimiu em pessoas.${S.ator}.chave_pub`);
  if (!existsSync(caminhoChave(S.ctx.home, S.ator))) throw new Recusa(1, "assinatura", `${S.ator} não tem chave neste computador (zeno chave nova)`);
}
export async function abrirChaveDaPessoa(S) {
  if (S.chave) return S.chave;
  exigirChaveConfigurada(S);
  S.chave = await comTentativas(S.ctx, S.ator, (pass) => abrirChave(S.ctx.home, S.ator, pass, S.cfg.pessoas[S.ator]?.chave_pub));
  return S.chave;
}
// D40: a passphrase errada pede de novo, até TENTATIVAS vezes, antes de recusar; o que o verbo já decidiu (a escolha da
// caixa) não se perde. Só a passphrase errada repete: a chave que não confere com a chave_pub recusa na hora.
export const TENTATIVAS = 3;
export async function comTentativas(ctx, ator, abrirCom) {
  for (let i = 1; ; i++) {
    const pass = await ctx.segredo(`passphrase de ${ator}: `);
    try { return abrirCom(pass); }
    catch (e) {
      if (!(e instanceof Recusa) || e.message !== "passphrase errada" || i >= TENTATIVAS) throw e;
      ctx.mostrar?.(`passphrase errada (tentativa ${i + 1} de ${TENTATIVAS})`);
    }
  }
}
function exigirChave(S) { if (!S.chave) throw new Recusa(3, "assinatura", "evento assinado sem chave aberta"); return S.chave; }

export const msgFio = (S, no, m) => { S.fios.push({ no, m }); S.tocados.add(no); };
export function gravarCorpo(S, no, fm, corpo) { S.nosEscritos.set(no, { fm, corpo }); S.tocados.add(no); }

// Vista do nó (T1): campos de controle vêm da projeção; descritivos e corpo ficam.
export function vista(S, id) {
  const st = S.proj.nos.get(id);
  if (!st) return;
  const atual = S.nosEscritos.get(id) || (() => { const n = lerNo(S.raiz, id); return n && { fm: n.fm, corpo: n.corpo }; })();
  if (!atual) return;
  const fm = { ...atual.fm };
  fm.zeno = 1; fm.id = id;
  for (const k of CONTROLE) fm[k] = controleDe(st, k);
  gravarNo(S.raiz, id, S.tr.fmParaDisco(fm), atual.corpo);
}
export function controleDe(st, k) {
  const v = st[k];
  if (["acoes", "checks", "depende_de"].includes(k)) return v && v.length ? v : undefined;
  if (k === "orcamento") return v || undefined;
  if (k === "pai") return v ?? null;
  return v;
}

export function gravar(S) {
  const fim = S.ctx.agora();
  for (const e of S.buf) if (!e.assinatura) e.dur_ms = fim - S.t0;
  mkdirSync(P(S.raiz).trabalho, { recursive: true });
  L.acrescentar(S.raiz, S.buf.map(S.tr.paraDisco));
  for (const { no, m } of S.fios) appendFileSync(caminhoFio(S.raiz, no), formatar(S.tr.msgParaDisco(m)));
  for (const id of S.tocados) vista(S, id);
  const ids = S.buf.map((e) => e.id);
  S.led.eventos.push(...S.buf); S.buf = []; S.fios = []; S.nosEscritos.clear(); S.tocados.clear();
  return ids;
}

export function fechar(S) { if (S.trava) destravar(S.trava); S.trava = null; S.chave = null; }
