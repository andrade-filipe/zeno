// config.mjs — achar o alvo, ler sistema.yaml + faixas.yaml com o piso do módulo, e a trava do alvo.
import { existsSync, readFileSync, writeFileSync, openSync, closeSync, writeSync, unlinkSync, renameSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "./yaml.mjs";
import { sha256, maxFaixa, faixaRank, lista, num, Recusa, FAIXAS, TAMANHOS } from "./util.mjs";

export const ZENO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const P = (raiz) => ({
  agents: join(raiz, ".agents"), sistema: join(raiz, ".agents", "sistema.yaml"), faixas: join(raiz, ".agents", "faixas.yaml"),
  ledger: join(raiz, ".agents", "ledger.jsonl"), trabalho: join(raiz, ".agents", "trabalho"), lock: join(raiz, ".agents", ".zeno.lock"),
  gerados: join(raiz, ".agents", "gerados.lock"), contaminacao: join(raiz, ".agents", ".contaminacao"),
});

export function acharAlvo(cwd, opt) {
  if (opt) { const r = resolve(cwd, opt); if (!existsSync(P(r).sistema)) throw new Recusa(2, "alvo", `sem .agents/sistema.yaml em ${r}`); return r; }
  let d = resolve(cwd);
  for (;;) {
    if (existsSync(P(d).sistema)) return d;
    const up = dirname(d);
    if (up === d) throw new Recusa(2, "alvo", "nenhum alvo do Zeno acima do diretório atual (use --alvo ou zeno install)");
    d = up;
  }
}

function lerYaml(path, errs) {
  if (!existsSync(path)) return { obj: {}, txt: "" };
  const txt = readFileSync(path, "utf8");
  const r = parseYaml(txt, path);
  errs.push(...r.errs);
  return { obj: r.obj || {}, txt };
}

export function modulo(nome) {
  const dir = join(ZENO_DIR, "modulos", nome);
  const errs = [];
  const m = lerYaml(join(dir, "modulo.yaml"), errs).obj;
  if (!m.nome) throw new Recusa(1, "modulo", `módulo desconhecido: ${nome}`);
  const fx = m.faixas ? lerYaml(join(dir, m.faixas), errs).obj : {};
  const lint = m.lint ? lerYaml(join(dir, m.lint), errs).obj : {};
  return { ...m, dir, faixasObj: fx, lintObj: lint, errs };
}

// Piso do módulo em tempo de execução (T19): vale o MAIS RESTRITIVO entre o módulo e o local, linha a linha.
export function fundirFaixas(mod, loc) {
  const piso = [], padrao = {}, gates = {}, acoes = {};
  for (const t of TAMANHOS) {
    const m = mod.padrao?.[t], l = loc.padrao?.[t];
    padrao[t] = maxFaixa(m, l);
    if (m && l && faixaRank(l) < faixaRank(m)) piso.push(`padrao.${t}: ${l} é mais frouxo que o do módulo (${m})`);
  }
  for (const f of FAIXAS) {
    const mg = mod.gates?.[f] || {}, lg = loc.gates?.[f] || {};
    gates[f] = {};
    for (const fase of new Set([...Object.keys(mg), ...Object.keys(lg)])) {
      if (fase.endsWith("_sombra")) { gates[f][fase] = lg[fase] ?? mg[fase]; continue; }
      gates[f][fase] = [...new Set([...lista(mg[fase]), ...lista(lg[fase])])];
    }
    for (const fase of Object.keys(mg)) if (!(fase in lg) && Object.keys(lg).length) piso.push(`gates.${f}.${fase} do módulo falta no local`);
  }
  for (const a of new Set([...Object.keys(mod.acoes || {}), ...Object.keys(loc.acoes || {})])) {
    const m = mod.acoes?.[a] || {}, l = loc.acoes?.[a] || {};
    acoes[a] = { faixa: maxFaixa(m.faixa, l.faixa), aprova: lista(l.aprova ?? m.aprova) };
    if (m.faixa && l.faixa && faixaRank(l.faixa) < faixaRank(m.faixa)) piso.push(`acoes.${a}: ${l.faixa} é mais frouxo que o do módulo (${m.faixa})`);
  }
  return { padrao, gates, acoes, piso };
}

export function carregar(raiz) {
  const p = P(raiz), errs = [];
  const sis = lerYaml(p.sistema, errs), fx = lerYaml(p.faixas, errs);
  const s = sis.obj;
  const mods = Object.keys(s.modulos || { nucleo: null });
  if (!mods.includes("nucleo")) mods.unshift("nucleo");
  const nucleo = modulo("nucleo");
  const f = fundirFaixas(nucleo.faixasObj, fx.obj);
  const pessoas = s.pessoas || {};
  // T82: agentes: é uma lista de ids (Inc. 1) ou um mapa id → perfil de sessão (o registro que o zeno sessao lê)
  const perfis = s.agentes && typeof s.agentes === "object" && !Array.isArray(s.agentes) ? s.agentes : {};
  return {
    raiz, errs, sistemaTxt: sis.txt, faixasTxt: fx.txt,
    config_sha256: sha256(sis.txt + fx.txt),
    alvo: s.alvo || "alvo", fronteira: s.fronteira || "pessoal",
    modulos: s.modulos || {}, nucleo,
    pessoas, agentes: Object.keys(perfis).length ? Object.keys(perfis) : lista(s.agentes), perfis,
    sessaoObrigatoria: s.sessao_obrigatoria === true || s.sessao_obrigatoria === "true",
    githooksEncadeado: typeof s.githooks_encadeado === "string" && s.githooks_encadeado.trim() ? s.githooks_encadeado.trim().replace(/\/+$/, "") : null, // T111
    mcp: lista(s.mcp), // T99: os servidores MCP que o agente usa neste alvo (padrão: nenhum); um perfil de agentes: estende

    padraoPapeis: s.padrao || {},
    delegacao: s.delegacao_padrao || {},
    checks: s.checks || {}, checksPadrao: lista(s.checks_padrao),
    ferramentas: lista(s.ferramentas), // T107: sobrescreve a detecção das ferramentas de terminal (editada pela pessoa)
    limites: { P_linhas: num(s.limites?.P_linhas) ?? 80 },
    teto: { tokens: num(s.orcamento?.teto_diario?.tokens), usd: num(s.orcamento?.teto_diario?.usd) },
    local: lista(s.local), gerar: s.gerar || {}, negarEscrita: lista(s.negar_escrita),
    fiacao: s.fiacao === "local" ? "local" : null, // T113: a saída da fiação versionada (editada pela pessoa)
    adocao: s.adocao === true || s.adocao === "true",
    padrao: f.padrao, gates: f.gates, acoes: f.acoes, pisoErros: f.piso,
  };
}

// T99: o servidor de uma ferramenta MCP (mcp__<servidor>__<ferramenta>) e a lista que vale para um ator
export const servidorMcp = (nome) => (String(nome).startsWith("mcp__") ? String(nome).slice(5).split("__")[0] : null);
export const mcpPermitidos = (cfg, ator) => [...new Set([...(cfg.mcp || []), ...lista(cfg.perfis?.[ator]?.mcp)])];
// os servidores que escrevem fora da máquina, conhecidos em 2026-11-03: vão no deny estático (camada 1) quando ninguém os
// lista; o hook (camada 2) nega também os que não estão aqui
export const MCP_ESCRITA = ["claude_ai_Gmail", "claude_ai_Google_Drive", "claude_ai_Google_Calendar", "claude_ai_Canva",
  "claude_ai_Claude_Docs", "vercel", "aws-mcp", "monday", "plugin_cloudflare_cloudflare", "claude-in-chrome"];

export const ehPessoa = (cfg, a) => typeof a === "string" && Object.prototype.hasOwnProperty.call(cfg.pessoas, a);

// ---------- trava (T44) ----------
function vivo(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } }
export function travar(raiz, agora, esperar = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)) {
  const lp = P(raiz).lock;
  const t0 = agora();
  for (;;) {
    try {
      const fd = openSync(lp, "wx");
      writeSync(fd, JSON.stringify({ pid: process.pid, ts: agora() }));
      closeSync(fd);
      return { lp, assumida: null };
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      let h = null; try { h = JSON.parse(readFileSync(lp, "utf8")); } catch {}
      const idade = h ? agora() - h.ts : Infinity;
      if (!h || !vivo(h.pid) || idade > 60000) {
        // assume a trava órfã: reescreve no lugar (nada é apagado)
        const tmp = lp + "." + process.pid;
        writeFileSync(tmp, JSON.stringify({ pid: process.pid, ts: agora() }));
        renameSync(tmp, lp);
        return { lp, assumida: { pid_antigo: h?.pid ?? null, idade_ms: Number.isFinite(idade) ? idade : null } };
      }
      if (agora() - t0 > 5000) throw new Recusa(5, "trava", `alvo ocupado por outro processo (pid ${h.pid})`);
      esperar(50);
    }
  }
}
export function destravar(t) {
  try { const h = JSON.parse(readFileSync(t.lp, "utf8")); if (h.pid === process.pid) unlinkSync(t.lp); } catch {}
}
export { mkdirSync };
