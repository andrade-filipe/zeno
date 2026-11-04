// habito.mjs — a deixa do hábito (T113): trabalho de agente num alvo sem nó tocado vira pedido de registrar --retro.
// Duas portas: o Stop do Claude Code (zeno guarda parar, pelo transcript) e o commit (validar --staged, qualquer
// ferramenta). Nada aqui cria nó: a deixa só pede, e o agente registra. Só leitura de transcript e de git.
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { subagentesDe } from "./gasto.mjs";
import { ehAgente } from "./util.mjs";

const ARQ = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
// o verbo que toca nó (o critério do fim-sessao, mais o novo e o registrar): abrir, andar, registrar (retro ou gasto),
// conversar no fio, ajustar, revisar e ler o contexto de um nó
const TOCA_NO = /(?:^|[\s;&|(])(?:zeno|node\s+\S*cli\.mjs)\s+(?:(?:novo|avancar|registrar|msg|ajustar|revisar)\b|contexto\s+["']?[a-z0-9])/;
const COMMIT = /(?:^|[\s;&|(])git(?:\s+-[Cc]\s+\S+)*\s+commit\b/;

// O comando pronto do retro: o agente troca os <…> e roda uma vez.
export function comandoRetro({ inicio, fim }) {
  return `zeno registrar "<o que foi feito>" --retro --tamanho P --expressa --porque "<por que>" --inicio ${inicio} --fim ${fim}`
    + ` --pronto "<o que prova>" --feito "<o que mudou>" --evidencia "<teste ou saída>" --ref "<commit ou arquivo>" --desfazer "<como voltar>"`;
}

// O texto da sessão: o transcript e os dos subagentes (core/gasto.mjs). null = sem transcript.
export function lerTextoDaSessao(principal) {
  if (!principal || !existsSync(principal)) return null;
  return [principal, ...subagentesDe(principal)].map((p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } }).join("\n");
}

// O que o transcript mostra: `trabalho` é o 1º arquivo do alvo editado fora de .agents/ (ou "git commit"), `tocou` diz se
// um comando zeno tocou nó, e `ini` é o 1º timestamp (o --inicio do retro). Caminho relativo parte do cwd do hook.
export function trabalhoNoTranscript(txt, raiz, cwd) {
  let trabalho = null, tocou = false, ini = null;
  const doAlvo = (fp) => {
    if (!fp) return null;
    const r = relative(raiz, resolve(cwd || raiz, String(fp)));
    return r && !r.startsWith("..") && !isAbsolute(r) && !/^\.agents(\/|$)/.test(r) ? r : null;
  };
  for (const l of String(txt).split("\n")) {
    if (!l.trim()) continue;
    let o; try { o = JSON.parse(l); } catch { continue; }
    if (typeof o.timestamp === "string" && !isNaN(Date.parse(o.timestamp)) && (!ini || o.timestamp < ini)) ini = o.timestamp;
    const c = o.message?.content;
    for (const b of Array.isArray(c) ? c : []) {
      if (b?.type !== "tool_use") continue;
      const inp = b.input || {};
      if (ARQ.has(b.name)) trabalho ??= doAlvo(inp.file_path || inp.notebook_path);
      else if (b.name === "Bash") {
        const cmd = String(inp.command || "");
        if (TOCA_NO.test(cmd)) tocou = true;
        if (COMMIT.test(cmd)) trabalho ??= "git commit";
      }
    }
  }
  return { trabalho, tocou, ini };
}

// Um nó mudado por agente desde o início da sessão (o id em variável de shell não aparece no comando, T55).
export const agenteNaJanela = (eventos, ini) => !!ini && eventos.some((e) => e.no && ehAgente(e.ator) && e.ts >= ini);

// A deixa do commit: o commit com caminho do alvo fora de .agents/, sem evento novo de nó no ledger do índice e sem nó
// em Execução. Merge não conta. Devolve null (passa) ou { arquivos, inicio } para o aviso ou o erro.
export function commitSemNo(S) {
  const g = (args) => S.ctx.git(args, { cwd: S.raiz });
  if (g(["rev-parse", "-q", "--verify", "MERGE_HEAD"]).status === 0) return null;
  const d = g(["diff", "--cached", "--name-only", "--relative"]);
  if (d.status !== 0) return null;
  const fora = d.stdout.split("\n").map((x) => x.trim()).filter((x) => x && !/^\.agents(\/|$)/.test(x));
  if (!fora.length) return null;
  if ([...S.proj.nos.values()].some((n) => n.fase === "execucao")) return null;
  const head = g(["show", "HEAD:./.agents/ledger.jsonl"]), idx = g(["show", ":./.agents/ledger.jsonl"]);
  const antes = new Set(head.status === 0 ? head.stdout.split("\n") : []);
  const novos = idx.status === 0 ? idx.stdout.split("\n").filter((l) => l.trim() && !antes.has(l)) : [];
  if (novos.some((l) => { try { return !!JSON.parse(l).no; } catch { return false; } })) return null;
  const quando = g(["log", "-1", "--format=%cI"]);
  const inicio = quando.status === 0 && !isNaN(Date.parse(quando.stdout.trim())) ? new Date(quando.stdout.trim()).toISOString() : null;
  return { arquivos: fora, inicio };
}
