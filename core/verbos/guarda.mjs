// guarda.mjs — os hooks da camada 2 (spec/seguranca.md): pre-tool, contaminou, fim-sessao, e a deixa parar (T113).
// Entrada: o JSON do hook no stdin. Saída de pre-tool: a decisão no formato do Claude Code. Erro ⇒ código ≠ 0 ⇒ "|| exit 2" nega.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { acharAlvo } from "../config.mjs";
import { abrir, ev, gravar, resolverAtor } from "../sessao.mjs";
import { sha256, Recusa } from "../util.mjs";
import { lerSessao, gravarDiferenca, naJanelaDe } from "../gasto.mjs";
import { lerTextoDaSessao, trabalhoNoTranscript, agenteNaJanela, comandoRetro } from "../habito.mjs";

import { negarShell, idsCitados } from "../shell.mjs";
import { arquivoProtegido } from "../protegidos.mjs";
import { arquivoDoRegistro } from "../alvos.mjs";
import { carregar, servidorMcp, mcpPermitidos } from "../config.mjs";
const ARQ = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

// Devolve a regra que nega o comando, ou null. Por tokenizador de shell (T67), não por regex sobre o texto cru.
export function negar(cmd) { return negarShell(String(cmd)); }
const POR_QUE = { "arquivo-protegido": "este arquivo é do sistema ou de outra raiz, e o estado muda pela CLI zeno; ou o código tem API de escrita e cita um arquivo protegido, mesmo dentro de um texto: texto se edita pelo Edit ou Write", "shell-ilegivel":"o zeno não entendeu este comando (aspas, $( ), crase ou here-doc sem fechar, ou aninhamento fundo) e nega por segurança; reescreva mais simples" };

// Uso medido da sessão a partir do transcript (T39): tokens, e bytes de ferramenta do Sistema × total.
// citacoes: cada nó citado num comando zeno, com o timestamp da linha (a CLI só divide o que veio depois da última
// medição); assistentes: quantas mensagens do modelo há (zero = sessão sem chamada de modelo, nada a medir).
export function medirTranscript(txt) {
  const vistos = new Set(), sistemaIds = new Set(), nos = new Set(), citacoes = [];
  let tokens = 0, cacheLeitura = 0, bytesSistema = 0, bytesTotal = 0, achou = false, ini = null, fim = null, assistentes = 0;
  const ehSistema = (b) => {
    const cmd = b.input?.command || "", fp = b.input?.file_path || b.input?.path || "";
    return (b.name === "Bash" && /(^|[\s;&|(])(zeno|node\s+\S*cli\.mjs)\s+[a-z]/.test(cmd)) || /\/\.agents\//.test(fp);
  };
  for (const l of String(txt).split("\n")) {
    if (!l.trim()) continue;
    let o; try { o = JSON.parse(l); } catch { continue; }
    if (typeof o.timestamp === "string") { if (!ini || o.timestamp < ini) ini = o.timestamp; if (!fim || o.timestamp > fim) fim = o.timestamp; }
    const m = o.message;
    if (!m) continue;
    if (o.type === "assistant" || m.role === "assistant") assistentes++;
    const u = m.usage;
    if (/*G:transcript-formato*/ u && m.id && !vistos.has(m.id)) {
      vistos.add(m.id); achou = true;
      tokens += (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0);
      cacheLeitura += u.cache_read_input_tokens || 0;
    }
    for (const b of Array.isArray(m.content) ? m.content : []) {
      if (b.type === "tool_use") {
        const n = Buffer.byteLength(JSON.stringify(b.input || {}));
        bytesTotal += n;
        if (ehSistema(b)) { bytesSistema += n; sistemaIds.add(b.id); }
        const cmd = b.input?.command || "";
        for (const mm of cmd.matchAll(/(?:\bzeno|cli\.mjs)\s+(?:avancar|gate|ajustar|msg|contexto|status|novo|registrar\s+gasto)\s+["']?([a-z0-9][a-z0-9-]{1,47})\b/g)) { nos.add(mm[1]); citacoes.push({ no: mm[1], ts: typeof o.timestamp === "string" ? o.timestamp : null }); }
      } else if (b.type === "tool_result") {
        const n = Buffer.byteLength(typeof b.content === "string" ? b.content : JSON.stringify(b.content ?? ""));
        bytesTotal += n;
        if (sistemaIds.has(b.tool_use_id)) bytesSistema += n;
      }
    }
  }
  return { achou, tokens, cacheLeitura, bytesSistema, bytesTotal, nos: [...nos], citacoes, ini, fim, assistentes };
}

// T82: a fronteira do zeno sessao está de pé? Devolve o motivo de não estar, ou null. Falha fechado: o marcador é o
// primeiro teste. Dentro ele é bind só-leitura, mas não é prova (T105): o de fora, com o mesmo uid, o forja e apaga os
// outros sinais com um bwrap sem privilégio. Sem marcador, é fora com certeza; com ele, é o que o processo declara.
export function foraDaFronteira(ctx) {
  const existe = ctx.existe || existsSync, env = ctx.env || {};
  if (!ctx.marcador) return "sem o marcador /run/zeno-agente (fora do zeno sessao)";
  if (existe("/run/WSL") || existe("/init")) return "o interop do Windows está à vista";
  if (existe(join(ctx.home, ".config/zeno"))) return "a pasta da chave do Zeno está à vista";
  if (env.WSL_INTEROP || env.CLAUDE_CODE_MESSAGING_SOCKET) return "o ambiente tem variável fora da allowlist";
  return null;
}

// T113: a deixa no Stop. Viu trabalho de agente no alvo (edição fora de .agents/ ou git commit) sem nó tocado na sessão:
// pede o registrar --retro uma vez por parada (stop_hook_active) e grava a recusa sem-no. Nunca impede a parada: entrada
// ruim, fora de alvo ou sem transcript ⇒ sai 0 calado; o hook gerado tem `|| true`. Não mede gasto nem limpa a
// contaminação (isso é do fim-sessao, no SessionEnd).
async function parar(ctx, reg) {
  const nada = { codigo: 0, msg: "" };
  let j;
  try { j = JSON.parse(await ctx.entrada()); } catch { return nada; }
  // o formato do Stop do Claude Code (sonda stop-formato): com stop_hook_active, o agente já está seguindo um block
  if (!j || typeof j !== "object" || /*G:stop-formato*/ j.stop_hook_active === true) return nada;
  let raiz;
  try { raiz = acharAlvo(j.cwd || ctx.cwd); } catch { return nada; }
  const txt = lerTextoDaSessao(j.transcript_path); // antes da trava, como no fim-sessao
  if (txt === null) return nada;
  const t = trabalhoNoTranscript(txt, raiz, j.cwd || raiz);
  if (!t.trabalho || t.tocou) return nada;
  const S = reg(abrir({ ...ctx, cwd: raiz }, {}));
  const semNo = !agenteNaJanela(S.led.eventos, t.ini);
  if (!(/*G:stop-sem-no*/ semNo)) return nada;
  const fim = new Date(ctx.agora()).toISOString(), inicio = t.ini ? new Date(t.ini).toISOString() : fim;
  ev(S, "recusa", null, { verbo: "guarda", regra: "sem-no", codigo: 1, porta: "stop", sessao_sha256: j.session_id ? sha256(String(j.session_id)) : null });
  gravar(S);
  const reason = `zeno: houve trabalho neste alvo (${t.trabalho}) e nenhum nó foi aberto nem registrado nesta sessão. `
    + `Registre o que foi feito, uma vez, trocando os <…>: ${comandoRetro({ inicio, fim })}. `
    + "Se o trabalho já tem nó, cite-o (zeno msg <id> …). Daqui em diante, abra o nó antes da 1ª edição.";
  return { codigo: 0, cru: JSON.stringify({ decision: "block", reason }) };
}

export async function guarda(ctx, pos, o, reg) {
  const sub = pos[0];
  if (!["pre-tool", "contaminou", "fim-sessao", "parar"].includes(sub)) throw new Recusa(2, "uso", "zeno guarda pre-tool|contaminou|fim-sessao|parar (hook)");
  if (sub === "parar") return parar(ctx, reg);
  let j;
  try { j = JSON.parse(await ctx.entrada()); } catch { throw new Recusa(1, "guarda", "a entrada do hook não é JSON"); }
  let raiz;
  try { raiz = acharAlvo(j.cwd || ctx.cwd); } catch { return { codigo: 0, msg: "" }; } // fora de um alvo: nada a guardar
  if (sub === "pre-tool") {
    let regra = null, citados = [], servidor = null;
    // T82: com sessao_obrigatoria no sistema.yaml, toda ferramenta é negada se a fronteira do zeno sessao não está de pé
    const fora = carregar(raiz).sessaoObrigatoria ? foraDaFronteira(ctx) : null;
    if (/*G:sem-sessao*/ fora) regra = "sem-sessao";
    else if (ARQ.has(j.tool_name)) {
      // T69: o mesmo rol da camada 1, resolvido em tempo de execução contra a raiz deste checkout (vale em clone e worktree)
      const fp = j.tool_input?.file_path || j.tool_input?.notebook_path;
      // T104: e os arquivos do registro de alvos da máquina (as regras por pasta são da pessoa; a lista, só da CLI)
      const casou = fp && (/*G:guarda-arquivo*/ arquivoProtegido(raiz, carregar(raiz), fp, j.cwd || raiz) || /*G:registro-maquina*/ arquivoDoRegistro(ctx, fp, j.cwd || raiz));
      if (casou) { regra = "arquivo-protegido"; citados = [String(fp).match(/\/trabalho\/([^/]+)\.fio\.md$/)?.[1]].filter(Boolean); }
    } else if (j.tool_name === "Bash") {
      regra = negar(j.tool_input?.command || "");
      citados = idsCitados(String(j.tool_input?.command || ""));
    } else if (servidorMcp(j.tool_name)) {
      // T99: MCP só por allowlist do alvo (sistema.yaml mcp:, padrão nenhum), estendida pelo perfil do ator em agentes:
      const cfg = carregar(raiz);
      let ator = null;
      try { ator = resolverAtor({ ...ctx, cwd: raiz }, cfg); } catch {}
      servidor = servidorMcp(j.tool_name);
      if (/*G:mcp-allowlist*/ !mcpPermitidos(cfg, ator).includes(servidor)) regra = "mcp-fora-da-lista";
    }
    if (!(/*G:guarda-shell*/ regra)) return { codigo: 0, msg: "" };
    const S = reg(abrir({ ...ctx, cwd: raiz }, {}));
    const no = citados.find((x) => S.proj.nos.has(x)) ?? null;
    ev(S, "recusa", no, { verbo: "guarda", regra, codigo: 2, sessao_sha256: j.session_id ? sha256(String(j.session_id)) : null, ...(servidor ? { servidor } : {}) });
    gravar(S);
    const porque = fora ? ` (${fora}; abra o agente por zeno sessao <agente>)`
      : servidor ? ` (o servidor MCP ${servidor} não está na lista mcp: do sistema.yaml deste alvo nem no perfil do agente; padrão: nenhum; quem libera é a pessoa)`
      : POR_QUE[regra] ? ` (${POR_QUE[regra]})` : "";
    return { codigo: 0, cru: JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `zeno: negado pela regra ${regra}${porque}. Não contorne: pare e escale.` } }) };
  }
  const sessao = sha256(String(j.session_id || ""));
  // fim-sessao: o transcript (e os dos subagentes) é lido antes da trava do ledger
  const tp = sub === "fim-sessao" ? j.transcript_path : null;
  const m = tp ? lerSessao(tp) : null;
  const S = reg(abrir({ ...ctx, cwd: raiz }, {}));
  if (sub === "contaminou") {
    const t = String(j.tool_name || "");
    ev(S, "contaminacao.marcada", null, { sessao_sha256: sessao, ferramenta: t.startsWith("mcp__") ? "mcp" : t });
    gravar(S);
    return { codigo: 0, msg: "" };
  }
  // fim-sessao. Por diferença (T66): o transcript é cumulativo, e a mesma sessão (retomada, medida antes pela CLI ou por
  // outro SessionEnd) só grava o que ainda não gravou neste ledger (core/gasto.mjs).
  // Sem transcript: indisponivel com o motivo. Transcript sem chamada de modelo: nada a medir, nada gravado.
  // Com chamada de modelo e sem usage: o formato quebrou (sonda transcript-formato), indisponivel com o motivo.
  if (!m) ev(S, "gasto.registrado", null, { tokens: 0, usd: 0, fonte: "indisponivel", sessao_sha256: sessao, origem: "fim-sessao", motivo: "sem-transcript" });
  else if (!m.achou && m.assistentes) ev(S, "gasto.registrado", null, { tokens: 0, usd: 0, fonte: "indisponivel", sessao_sha256: sessao, origem: "fim-sessao", motivo: "formato" });
  else if (m.achou) gravarDiferenca(S, m, { sessao, origem: "fim-sessao", naJanela: naJanelaDe(S, m) });
  if (S.proj.alvo.contaminadas.has(sessao)) ev(S, "contaminacao.limpa", null, { sessao_sha256: sessao, como: "fim-sessao" });
  if (S.buf.length) gravar(S);
  return { codigo: 0, msg: m ? `sessão medida: ${m.tokens} tokens (${m.subagentes} subagentes), sistema ${m.bytesSistema}/${m.bytesTotal} bytes` : "transcript indisponível" };
}
