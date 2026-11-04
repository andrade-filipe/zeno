// util.mjs — peças pequenas do core do Zeno (sem dependências; D28).
import { createHash, randomBytes } from "node:crypto";

export const FASES = ["intencao", "especificacao", "execucao", "verificacao", "entrega", "observacao", "aprendizado"];
export const TITULO_FASE = {
  intencao: "Intenção", especificacao: "Especificação", execucao: "Execução", verificacao: "Verificação",
  entrega: "Entrega", observacao: "Observação", aprendizado: "Aprendizado",
};
export const FAIXAS = ["autonoma", "aprovacao", "nunca"];
export const TIPOS = ["iniciativa", "tarefa", "licao", "proposta"];
export const TAMANHOS = ["P", "M", "G"];
export const ESTADOS = ["ativo", "em-gate", "pausado", "fechado", "cancelado"];

export const sha256 = (s) => createHash("sha256").update(s).digest("hex");
export const novoId = (ms) => `${ms.toString(36)}-${randomBytes(4).toString("hex")}`;
export const semAcento = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
export const slug = (t) => semAcento(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");
export const faixaRank = (f) => FAIXAS.indexOf(f);
export const maxFaixa = (...fs) => fs.filter((f) => FAIXAS.includes(f)).reduce((a, b) => (faixaRank(b) > faixaRank(a) ? b : a), "autonoma");
export const faseIdx = (f) => (f === "fechado" ? FASES.length : FASES.indexOf(f));
export const ehAgente = (a) => typeof a === "string" && a.startsWith("ia:");

// JSON canônico: chaves em ordem, sem espaço, campos undefined fora (a base da assinatura).
export function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v);
}

// "7d", "12h", "0d" → ms
export function duracao(s) {
  const m = String(s ?? "0d").match(/^(\d+)([dh])$/);
  if (!m) return null;
  return Number(m[1]) * (m[2] === "d" ? 86400000 : 3600000);
}

// T117: a semana ISO 8601 (UTC) de um instante em ms, "AAAA-Www": a semana começa na segunda, e a 1ª do ano é a da 1ª quinta.
export function semanaIso(ms) {
  const d = new Date(ms), dia = (d.getUTCDay() + 6) % 7; // 0 = segunda
  const quinta = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dia + 3);
  const ano = new Date(quinta).getUTCFullYear(), n = 1 + Math.floor((quinta - Date.UTC(ano, 0, 1)) / (7 * 86400000));
  return `${ano}-W${String(n).padStart(2, "0")}`;
}

export const num = (x) => (x === null || x === undefined || x === "" ? null : Number(x));
export const lista = (x) => (x === null || x === undefined ? [] : Array.isArray(x) ? x : [x]);

// Recusa: um verbo diz "não" por uma regra. codigo: 1 regra · 2 uso · 3 pessoa · 4 orçamento · 5 trava · 6 não implementado.
export class Recusa extends Error {
  constructor(codigo, regra, msg, extra = {}) { super(msg); this.codigo = codigo; this.regra = regra; Object.assign(this, extra); }
}
