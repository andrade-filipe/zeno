// ledger.mjs — o ledger append-only, contrato v1 (spec/ledger.md).
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { P } from "./config.mjs";

export const V = 1;
const COMUNS = ["v", "id", "ts", "ev", "alvo", "no", "ator", "estrato", "dur_ms", "cmd", "config_sha256", "dados"];
export const EVENTOS = new Set([
  "no.criado", "fase.avancou", "artefato.incompleto", "artefato.escrito", "gate.aberto", "gate.decidido", "gate.retirado", "msg.enviada",
  "msg.recusada", "gasto.registrado", "disjuntor.disparou", "disjuntor.liberado", "teto_diario.estourou", "orcamento.alterado", "ajuste",
  "faixa.alterada", "no.cancelado", "contaminacao.marcada", "contaminacao.limpa", "contexto.montado", "recusa",
  "trava.assumida", "install.executado", "sync.executado", "sessao.aberta", "sessao.fechada",
]);

// Lê e checa cada linha. v desconhecido: a linha é pulada e contada (não falha o arquivo).
export function lerTexto(txt, rel = ".agents/ledger.jsonl") {
  const eventos = [], erros = [], ids = new Set();
  let puladas = 0;
  String(txt).split("\n").forEach((l, k) => {
    if (!l.trim()) return;
    let o;
    try { o = JSON.parse(l); } catch { erros.push([rel, k + 1, "ledger", "linha não é JSON"]); return; }
    if (o.v !== V) { puladas++; return; }
    for (const c of COMUNS) if (!(c in o)) erros.push([rel, k + 1, "ledger", `campo comum faltando: ${c}`]);
    if (ids.has(o.id)) erros.push([rel, k + 1, "ledger", `id duplicado: ${o.id}`]);
    ids.add(o.id);
    Object.defineProperty(o, "_linha", { value: k + 1, enumerable: false });
    eventos.push(o);
  });
  eventos.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { eventos, erros, puladas };
}

export function ler(raiz) {
  const p = P(raiz).ledger;
  return lerTexto(existsSync(p) ? readFileSync(p, "utf8") : "");
}

export function acrescentar(raiz, evs) {
  if (!evs.length) return;
  appendFileSync(P(raiz).ledger, evs.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

// Append-only (T6): as linhas do antes aparecem iguais e na mesma ordem (subsequência) no depois.
export function subsequencia(antes, depois) {
  const a = String(antes).split("\n").filter((l) => l !== ""), d = String(depois).split("\n").filter((l) => l !== "");
  let j = 0;
  for (const l of d) if (j < a.length && l === a[j]) j++;
  return j === a.length;
}
