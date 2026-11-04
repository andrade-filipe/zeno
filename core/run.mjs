// run.mjs — o despacho dos verbos. O core recebe ctx (io, env, git, relógio) por injeção (T16): só o cli.mjs toca o processo.
import * as Esc from "./verbos/escrita.mjs";
import * as Lei from "./verbos/leitura.mjs";
import { validar } from "./verbos/validar.mjs";
import { install, sync } from "./verbos/instalar.mjs";
import { guarda } from "./verbos/guarda.mjs";
import { promover } from "./verbos/promover.mjs";
import { sessao } from "./verbos/lancar.mjs";
import { alvos } from "./verbos/alvos.mjs";
import { vista } from "./verbos/vista.mjs";
import { ev, gravar, fechar } from "./sessao.mjs";
import { Recusa } from "./util.mjs";
import { lerSessaoDaCli, medirNaCli } from "./gasto.mjs";

export const VERSAO = "0.1.0";
const BOOL = new Set(["json", "expressa", "staged", "reparar", "adocao", "sem-sync", "aprovar", "reprovar", "descontaminar", "sem-agents", "retro", "codigo", "promover", "bloco", "detalhe", "completo", "plano", "pem", "despausar", "descobrir", "esquecer", "obsidian"]);
const REPET = new Set(["acao", "origem", "check", "depende", "refs"]);
const MUDA = new Set(["novo", "avancar", "gate", "ajustar", "revisar", "msg", "registrar", "contexto", "install", "sync", "promover", "sessao"]);
// os verbos que mudam estado de nó medem o gasto da sessão pela CLI, pela variável CLAUDE_CODE_SESSION_ID
const MEDE = new Set(["novo", "avancar", "registrar"]);

// --check é bool no sync e repetível (com valor) no novo; --codigo é bool ou leva o diretório.
export function parseArgs(argv) {
  const pos = [], o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") { o["--"] = argv.slice(i + 1); break; } // T82: o resto é o comando (zeno sessao <agente> -- cmd …)
    if (!a.startsWith("--")) { pos.push(a); continue; }
    let [k, v] = a.slice(2).split(/=(.*)/s);
    if (v === undefined) {
      if (BOOL.has(k)) v = true;
      else if (i + 1 < argv.length && !(argv[i + 1].startsWith("--") && argv[i + 1].length > 2)) v = argv[++i];
      else v = true;
    }
    if (REPET.has(k)) (o[k] ||= []).push(v); else o[k] = v;
  }
  return { pos, o };
}

const AJUDA = `zeno — o core do Zeno (spec: zeno/spec/cli.md)
  novo "<título>" --tamanho P|M|G [--pai id] [--expressa --porque …]   cria um nó
  avancar <id> [--ate fase|fim] [--pronto … --feito … --evidencia … --ref … --desfazer …]
  gate <id> --aprovar|--reprovar [--motivo …] | --orcamento dim=+N | --despausar --motivo … · gate --teto dim=+N | --descontaminar (sem id)   (pessoa)
  caixa [--de x] · caixa --aprovar (pessoa, em lote) · pendentes [--de x] · status [id]
  vista --obsidian [--check] [--saida dir]   o grafo do alvo como notas com links de wiki, em zeno-grafo/ (fora do git)
  msg <id> <tipo> --para x --<campo> "…" · ajustar <id> campo=valor … · revisar <id> --motivo … · contexto <id> [--fase f]
  validar [--staged] [--reparar] [--codigo dir] · install <dir> [--adocao] [--sem-sync] · sync [--check]
  registrar "<título>" --retro … · registrar gasto <id> --tokens N · chave nova | pub [--pem|--em f] (pessoa) · promover [--publicar <clone>] (pessoa) · versao · ajuda
  sessao <agente> [--plano] [-- comando …]   abre a CLI do agente num bwrap com o perfil do registro agentes: (T82)
  alvos [--descobrir <pasta>… | --esquecer <caminho>…]   os alvos da máquina e a fronteira efetiva de cada um (T104)
  ferramentas   as ferramentas de terminal do alvo: presente, login e serviço, sem ler segredo (T107)
  guarda   a entrada dos hooks (lê o pedido do stdin) · ajuda --json   esta ajuda como dado: verbos, pessoa, códigos (T91)
Códigos: 0 ok · 1 regra · 2 uso · 3 pessoa · 4 orçamento · 5 trava · 6 não implementado · 9 bug.`;

// T91: a mesma ajuda como dado (zeno ajuda --json), para a sessão de docs e outra porta não rasparem o texto.
// pessoa: só uma pessoa (TTY, sem marcador nem CLI de agente acima) roda; pessoa_se: o caso em que passa a pedir pessoa.
// muda: escreve no ledger ou nos arquivos do alvo. quem: "hook" (T92): só o hook chama; a camada 2 nega ao agente no shell,
// e a pessoa não o chama à mão. Um teste confere que todo verbo do despacho está aqui e no texto.
export const CATALOGO = [
  { verbo: "novo", uso: 'novo "<título>" --tamanho P|M|G [--pai id] [--expressa --porque …]', faz: "cria um nó", pessoa: false, muda: true },
  { verbo: "avancar", uso: "avancar <id> [--ate fase|fim] [--pronto … --feito … --evidencia … --ref … --desfazer …]", faz: "escreve os artefatos da fase e passa o gate de check; para no gate humano", pessoa: false, muda: true },
  { verbo: "gate", uso: "gate <id> --aprovar|--reprovar [--motivo …] | --orcamento dim=+N | --despausar --motivo … · gate --teto dim=+N | --descontaminar (sem id)", faz: "decide um gate humano, amplia o orçamento de um nó, solta um nó do disjuntor ou libera o teto diário do alvo por um dia; assinado", pessoa: true, muda: true },
  { verbo: "caixa", uso: "caixa [--de x]", faz: "lista as mensagens que esperam pelo destinatário", pessoa: false, muda: false },
  { verbo: "caixa --aprovar", uso: "caixa --aprovar [--motivo …] [--promover] [--de dir]", faz: "aprova os gates abertos em lote, com uma passphrase", pessoa: true, muda: true },
  { verbo: "pendentes", uso: "pendentes [--de x]", faz: "os gates abertos e as pendências, com a vista de cada gate", pessoa: false, muda: false },
  { verbo: "status", uso: "status [id]", faz: "o estado dos nós, ou de um nó", pessoa: false, muda: false },
  { verbo: "msg", uso: 'msg <id> <tipo> --para x --<campo> "…"', faz: "escreve uma mensagem no fio do nó (lint dos 7 tipos)", pessoa: false, muda: true },
  { verbo: "ajustar", uso: "ajustar <id> campo=valor …", faz: "muda campo do nó", pessoa: false, pessoa_se: "afrouxa (faixa, teto, revisor, cancelar): pede pessoa e --motivo", muda: true },
  { verbo: "revisar", uso: "revisar <id> --motivo …", faz: "tira da caixa o gate aberto de um nó que volta para revisão", pessoa: false, muda: true },
  { verbo: "contexto", uso: "contexto <id> [--fase f] [--bloco]", faz: "o contexto de uma fase do nó; --bloco sai no formato do SessionStart", pessoa: false, muda: true },
  { verbo: "vista", uso: "vista --obsidian [--check] [--saida <dir>]", faz: "escreve o grafo de trabalho do alvo como notas com links de wiki numa pasta visível e fora do git; --check só confere a deriva", pessoa: false, muda: true },
  { verbo: "validar", uso: "validar [--staged] [--reparar] [--codigo dir]", faz: "confere o alvo contra o ledger (e o código isolado); --reparar refaz o frontmatter pela projeção", pessoa: false, muda: false },
  { verbo: "install", uso: "install <dir> [--adocao] [--sem-sync]", faz: "instala o Zeno num alvo", pessoa: false, muda: true },
  { verbo: "sync", uso: "sync [--check]", faz: "gera os arquivos derivados do módulo (hooks, bloco do AGENTS.md); --check só confere", pessoa: false, muda: true },
  { verbo: "registrar", uso: 'registrar "<título>" --retro … | registrar gasto <id> --tokens N', faz: "registra trabalho feito fora do Zeno, ou gasto de um nó", pessoa: false, muda: true },
  { verbo: "chave", uso: "chave nova | chave pub [--pem | --em <arquivo>]", faz: "gera a chave de assinatura da pessoa; pub imprime a pública da chave que já existe (com a passphrase)", pessoa: true, muda: true },
  { verbo: "promover", uso: "promover [--de dir] [--publicar <clone>]", faz: "prova (testes e censo no sandbox) e liga a cópia fixada do Zeno, com evento assinado; --publicar roda o portão de publicação e prepara o commit e a tag no clone público, sem push e sem trocar a cópia", pessoa: true, muda: true },
  { verbo: "sessao", uso: "sessao <agente> [--plano] [-- comando …]", faz: "abre a CLI do agente num bwrap com o perfil do registro agentes:", pessoa: false, muda: true },
  { verbo: "alvos", uso: "alvos [--descobrir <pasta>… | --esquecer <caminho>…]", faz: "lista os alvos da máquina (registro fora do git) com a fronteira declarada, a da regra por pasta e a efetiva; --descobrir e --esquecer mantêm a lista", pessoa: false, muda: true },
  { verbo: "ferramentas", uso: "ferramentas [--json]", faz: "as ferramentas de terminal do alvo (detectadas, ou a chave ferramentas: do sistema.yaml): se estão no PATH, se o login responde e se o serviço está de pé; nunca lê segredo e não grava nada", pessoa: false, muda: false },
  { verbo: "guarda", uso: "guarda", faz: "a entrada dos hooks; lê o pedido do stdin e grava recusa, contaminação e gasto", pessoa: false, quem: "hook", muda: true },
  { verbo: "versao", uso: "versao", faz: "a versão", pessoa: false, muda: false },
  { verbo: "ajuda", uso: "ajuda [--json]", faz: "esta ajuda; --json a dá como dado", pessoa: false, muda: false },
];
export const CODIGOS = [
  { codigo: 0, nome: "ok" }, { codigo: 1, nome: "regra", o_que: "uma regra recusou; não contorne, escale" },
  { codigo: 2, nome: "uso", o_que: "argumento errado ou faltando" }, { codigo: 3, nome: "pessoa", o_que: "pede uma pessoa: avise e siga com outra coisa" },
  { codigo: 4, nome: "orçamento", o_que: "o teto do nó ou o teto diário do alvo estourou, ou o nó está pausado pelo disjuntor" }, { codigo: 5, nome: "trava", o_que: "outro processo segura a trava do alvo" },
  { codigo: 6, nome: "não implementado" }, { codigo: 9, nome: "bug", o_que: "erro inesperado no Zeno" },
];

const VERBOS = {
  novo: Esc.novo, avancar: Esc.avancar, gate: Esc.gate, ajustar: Esc.ajustar, revisar: Esc.revisar, msg: Esc.msg, registrar: Esc.registrar, chave: Esc.chave,
  caixa: (c, p, o, r) => (o.aprovar ? Esc.caixaAprovar(c, p, o, r) : Lei.caixa(c, p, o, r)),
  pendentes: Lei.pendentes, status: Lei.status, contexto: Lei.contexto, validar, install, sync, guarda, promover, sessao, alvos, vista, ferramentas: Lei.ferramentas,
  versao: async () => ({ codigo: 0, msg: `zeno ${VERSAO}` }),
  ajuda: async () => ({ codigo: 0, msg: AJUDA, dados: { versao: VERSAO, verbos: CATALOGO, codigos: CODIGOS } }),
};
export const NOMES_DOS_VERBOS = Object.keys(VERBOS);

// Devolve { codigo, stdout, stderr }.
export async function run(argv, ctx) {
  const { pos, o } = parseArgs(argv);
  const verbo = pos.shift() || "ajuda";
  let S = null, r;
  const reg = (s) => (S = s);
  const mostrados = [];
  const c = { mostrar: (t) => mostrados.push(t), ...ctx };
  // o gasto da sessão (core/gasto.mjs): o transcript é lido aqui, antes de o verbo pegar a trava do ledger
  const lido = MEDE.has(verbo) ? lerSessaoDaCli(c) : null;
  try {
    const f = VERBOS[verbo];
    if (!f) throw new Recusa(2, "uso", `verbo desconhecido: ${verbo} (zeno ajuda)`);
    r = await f(c, pos, o, reg);
  } catch (e) {
    if (!(e instanceof Recusa)) { r = { codigo: 9, msg: "", erros: [{ regra: "bug", msg: e.stack || String(e) }] }; }
    else {
      r = { codigo: e.codigo, msg: "", erros: [{ regra: e.regra, msg: e.message }] };
      // recusa de verbo que muda estado vira atrito medido; o que já estava no buffer são fatos e ficam
      if (S && S.trava && MUDA.has(verbo) && [1, 3, 4].includes(e.codigo)) {
        try { ev(S, "recusa", S.proj.nos.has(pos[0]) ? pos[0] : null, { verbo, regra: e.regra, codigo: e.codigo }); r.eventos = gravar(S); } catch {}
      }
    }
  } finally {
    // Com a trava ainda segura: a diferença do gasto vai para os nós que o verbo tocou. Só com o buffer vazio (o verbo
    // gravou o que tinha; um buffer abandonado por recusa de uso não pode sair de carona). A medição nunca muda o código
    // do verbo; se falhar, sai como aviso, não calada.
    if (S && S.trava && lido && !S.buf.length) {
      try { if (medirNaCli(S, lido)) gravar(S); }
      catch (e) { S.buf = []; r.avisos = [...(r.avisos || []), { regra: "gasto", msg: `a medição do gasto falhou: ${e.message}` }]; }
    }
    if (S) fechar(S);
  }
  const erros = r.erros || [];
  if (r.cru !== undefined) return { codigo: r.codigo, stdout: r.cru, stderr: "" };
  if (o.json) return { codigo: r.codigo, stdout: JSON.stringify({ v: 1, verbo, ok: r.codigo === 0, codigo: r.codigo, dados: r.dados ?? {}, erros, avisos: r.avisos ?? [], eventos: r.eventos ?? [] }) + "\n", stderr: mostrados.join("\n") };
  const fmt = (x) => `${x.arquivo ? `${x.arquivo}:${x.linha ?? 0} ` : ""}${x.regra} ${x.msg}`;
  return {
    codigo: r.codigo,
    stdout: [...mostrados, r.msg].filter(Boolean).join("\n") + (r.msg || mostrados.length ? "\n" : ""),
    stderr: [...erros.map(fmt), ...(r.avisos || []).map((a) => "aviso " + fmt(a))].join("\n") + (erros.length || r.avisos?.length ? "\n" : ""),
  };
}
