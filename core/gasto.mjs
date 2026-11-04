// gasto.mjs — a medição do gasto da sessão (D19, T39/T55/T66), pela CLI e pelo hook SessionEnd.
// A CLI acha o transcript pela variável CLAUDE_CODE_SESSION_ID, que o Bash do Claude Code exporta (o nome do arquivo é o
// id da sessão; num subagente, a variável traz o id da sessão-mãe). Os transcripts dos subagentes ficam em
// <sessão>/subagents/agent-*.jsonl e entram na conta. Só leitura: o transcript nunca é escrito.
// A leitura acontece ANTES da trava do ledger (o transcript chega a dezenas de MB); a diferença, depois, com o ledger aberto.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { medirTranscript } from "./verbos/guarda.mjs";
import { ev } from "./sessao.mjs";
import { sha256, ehAgente } from "./util.mjs";

const ID_SESSAO = /^[A-Za-z0-9][A-Za-z0-9-]{7,63}$/;

// Os transcripts dos subagentes de uma sessão: <dir>/<id>/subagents/agent-*.jsonl, em ordem.
export function subagentesDe(principal) {
  const dir = join(principal.replace(/\.jsonl$/, ""), "subagents");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^agent-.*\.jsonl$/.test(f)).sort().map((f) => join(dir, f));
}

// Lê o principal e os subagentes e mede tudo junto (o dedup por message.id vale entre os arquivos).
export function lerSessao(principal) {
  if (!principal || !existsSync(principal)) return null;
  const subs = (/*G:gasto-subagentes*/ subagentesDe(principal)) || [];
  const txt = [principal, ...subs].map((p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } }).join("\n");
  return { ...medirTranscript(txt), subagentes: subs.length };
}

// O transcript da sessão em que a CLI roda, ou null (sem a variável, id fora do formato, ou arquivo não achado).
// Procura <config>/projects/*/<id>.jsonl: a pasta do projeto é a de onde a sessão abriu, que a CLI não sabe.
export function transcriptDaSessao(ctx) {
  const env = ctx.env || {}, id = env.CLAUDE_CODE_SESSION_ID;
  if (!id || !ID_SESSAO.test(id)) return null;
  const base = join(env.CLAUDE_CONFIG_DIR || join(ctx.home || "", ".claude"), "projects");
  let dirs = [];
  try { dirs = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return null; }
  for (const d of dirs) { const p = join(base, d, `${id}.jsonl`); if (existsSync(p)) return { id, principal: p }; }
  return null;
}

// A leitura pela CLI, antes da trava: { sessao, m } ou null. Nunca lança (a medição não muda o código do verbo).
export function lerSessaoDaCli(ctx) {
  try {
    const t = transcriptDaSessao(ctx);
    if (!t) return null;
    const m = lerSessao(t.principal);
    return m ? { sessao: sha256(t.id), m } : null;
  } catch { return null; }
}

// O que esta sessão já gravou neste ledger: o total cumulativo da última medição (sessao_total) mais as medições do
// formato antigo depois dela (sem sessao_total: a soma das partes, T66). Devolve também o ts da última medição.
export function jaMedido(eventos, sessao) {
  let acc = { tokens: 0, cache: 0, bs: 0, bt: 0 }, ts = null;
  for (const e of eventos) {
    if (e.ev !== "gasto.registrado" || e.dados?.fonte !== "medido" || e.dados.sessao_sha256 !== sessao) continue;
    const d = e.dados, n = d.nos_na_sessao || 1;
    if (d.sessao_total) acc = { ...d.sessao_total };
    else acc = { tokens: acc.tokens + (d.tokens || 0), cache: acc.cache + (d.tokens_cache_leitura || 0) / n, bs: acc.bs + (d.bytes_sistema || 0) / n, bt: acc.bt + (d.bytes_total || 0) / n };
    if (!ts || e.ts > ts) ts = e.ts;
  }
  return { acc, ts };
}

// Grava a diferença da sessão neste ledger. origem: "cli" | "fim-sessao". nosDaChamada: os nós que o verbo tocou.
// Os nós da sessão desde a última medição são os citados nos comandos zeno do transcript depois dela, mais os da chamada
// (e, no fim-sessao, os mudados por agente na janela). Os citados que não são deste alvo são de outro ledger: contam na
// divisão, mas a parte deles não é gravada aqui. Devolve quantos eventos gravou.
export function gravarDiferenca(S, m, { sessao, origem, nosDaChamada = [], naJanela = [] }) {
  const { acc, ts } = jaMedido([...S.led.eventos, ...S.buf], sessao);
  const d = { tokens: Math.max(0, m.tokens - acc.tokens), cache: Math.max(0, Math.round(m.cacheLeitura - acc.cache)), bs: Math.max(0, Math.round(m.bytesSistema - acc.bs)), bt: Math.max(0, Math.round(m.bytesTotal - acc.bt)) };
  if (!d.tokens && !d.bt) return 0;
  const depois = (c) => !ts || (c.ts && c.ts > ts);
  const citados = [...(m.citacoes || []), ...naJanela].filter(depois).map((c) => c.no);
  const todos = [...new Set([...nosDaChamada, ...citados])];
  const daqui = todos.filter((x) => S.proj.nos.has(x)), fora = todos.length - daqui.length;
  const alvos = daqui.length ? daqui : [null];
  const total = Math.max(1, daqui.length + fora);
  const parte = Math.round(d.tokens / total);
  const sessao_total = { tokens: m.tokens, cache: m.cacheLeitura, bs: m.bytesSistema, bt: m.bytesTotal };
  for (const no of alvos) ev(S, "gasto.registrado", no, {
    tokens: no ? parte : fora ? 0 : d.tokens, usd: 0, fonte: "medido", bytes_sistema: d.bs, bytes_total: d.bt,
    tokens_cache_leitura: d.cache, nos_na_sessao: total, sessao_sha256: sessao, ja_medido_tokens: acc.tokens,
    origem, subagentes: m.subagentes || 0, nos_fora: fora, sessao_total,
  });
  return alvos.length;
}

// Depois do verbo, com a trava ainda segura: a diferença vai para os nós que o verbo tocou (eventos deste cmd).
// Transcript sem chamada de modelo não grava nada; com chamada e sem usage (formato quebrou), um indisponivel por sessão.
export function medirNaCli(S, lido) {
  if (!lido) return 0;
  const { sessao, m } = lido;
  S.retro = null; // a medição é de agora, mesmo depois de um registrar --retro

  if (!m.achou) {
    if (!m.assistentes) return 0;
    if (S.led.eventos.some((e) => e.ev === "gasto.registrado" && e.dados?.fonte === "indisponivel" && e.dados.sessao_sha256 === sessao && e.dados.motivo === "formato")) return 0;
    ev(S, "gasto.registrado", null, { tokens: 0, usd: 0, fonte: "indisponivel", sessao_sha256: sessao, origem: "cli", motivo: "formato" });
    return 1;
  }
  const nosDaChamada = [...new Set(S.led.eventos.filter((e) => e.cmd === S.cmd && e.no).map((e) => e.no))];
  return gravarDiferenca(S, m, { sessao, origem: "cli", nosDaChamada });
}

// Os nós mudados por agente na janela da sessão (T55: o comando sozinho perde id em variável de shell).
export function naJanelaDe(S, m) {
  return m?.ini ? S.led.eventos.filter((e) => e.no && ehAgente(e.ator) && e.ts >= m.ini && e.ts <= m.fim).map((e) => ({ no: e.no, ts: e.ts })) : [];
}
