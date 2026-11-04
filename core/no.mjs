// no.mjs — o arquivo do nó: frontmatter (vista) + 7 seções de fase (spec/no.md).
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { separar, dump } from "./yaml.mjs";
import { FASES, TITULO_FASE, semAcento, sha256 } from "./util.mjs";
import { P } from "./config.mjs";

const FASE_DO_TITULO = Object.fromEntries(FASES.map((f) => [semAcento(TITULO_FASE[f]).toLowerCase(), f]));
export const ORDEM_FM = ["zeno", "id", "tipo", "titulo", "criado", "pai", "depende_de", "arestas", "fase", "estado", "dono", "executor",
  "revisor", "tamanho", "faixa", "acoes", "procedencia", "origem", "orcamento", "janela", "modulo", "checks", "refs", "fundamento"];
export const CONTROLE = ["tipo", "pai", "fase", "estado", "dono", "executor", "revisor", "tamanho", "faixa", "acoes", "procedencia",
  "depende_de", "orcamento", "janela", "checks"];
export const DESCRITIVOS = ["titulo", "origem", "arestas", "refs", "fundamento", "modulo"];

export const caminhoNo = (raiz, id) => join(P(raiz).trabalho, `${id}.md`);
export const caminhoFio = (raiz, id) => join(P(raiz).trabalho, `${id}.fio.md`);

export function idsNoDisco(raiz) {
  const d = P(raiz).trabalho;
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((f) => f.endsWith(".md") && !f.endsWith(".fio.md") && !f.startsWith("_")).map((f) => f.slice(0, -3)).sort();
}

const semComentario = (t) => t.replace(/<!--[\s\S]*?-->/g, "");

// Seções por fase: { fase: texto } e a ordem em que apareceram.
export function secoes(corpo) {
  const out = {}, ordem = [];
  let cur = null;
  for (const l of corpo.split("\n")) {
    const h = l.match(/^## (.+?)\s*$/);
    if (h) { cur = FASE_DO_TITULO[semAcento(h[1]).toLowerCase()] ?? null; if (cur) { ordem.push(cur); out[cur] = ""; } continue; }
    if (/^# /.test(l)) { cur = null; continue; }
    if (cur) out[cur] += l + "\n";
  }
  return { out, ordem };
}

// Linhas-chave "- chave: valor" de uma seção (comentários não contam: T35).
export function chaves(texto) {
  const r = {};
  for (const l of semComentario(texto || "").split("\n")) {
    const m = l.match(/^- ([a-z][a-z0-9-]*):\s*(.*?)\s*$/);
    if (m && m[2] !== "") r[m[1]] = m[2];
  }
  return r;
}

export function escreverChave(corpo, fase, chave, valor) {
  const linhas = corpo.split("\n");
  let ini = -1, fim = linhas.length;
  for (let i = 0; i < linhas.length; i++) {
    const h = linhas[i].match(/^## (.+?)\s*$/);
    if (h && ini < 0 && FASE_DO_TITULO[semAcento(h[1]).toLowerCase()] === fase) { ini = i; continue; }
    if (ini >= 0 && /^#{1,2} /.test(linhas[i])) { fim = i; break; }
  }
  if (ini < 0) return corpo;
  const nova = `- ${chave}: ${String(valor).replace(/\s*\n\s*/g, " ")}`;
  for (let i = ini + 1; i < fim; i++) if (linhas[i].startsWith(`- ${chave}:`)) { linhas[i] = nova; return linhas.join("\n"); }
  let ult = ini;
  for (let i = ini + 1; i < fim; i++) if (linhas[i].trim()) ult = i;
  linhas.splice(ult + 1, 0, nova);
  return linhas.join("\n");
}

export function corpoInicial(titulo) {
  return `\n# ${titulo}\n\n` + FASES.map((f) => `## ${TITULO_FASE[f]}\n`).join("\n");
}

// sha do artefato aprovado (T15): seções da intencao até a fase, sem comentários, aparadas.
export function shaArtefato(corpo, ateFase) {
  const { out } = secoes(corpo);
  const ate = FASES.indexOf(ateFase);
  return sha256(FASES.slice(0, ate + 1).map((f) => `${f}\n${semComentario(out[f] || "").trim()}`).join("\n"));
}

export function lerNo(raiz, id) {
  const p = caminhoNo(raiz, id);
  const rel = `.agents/trabalho/${id}.md`;
  if (!existsSync(p)) return null;
  const txt = readFileSync(p, "utf8");
  const { fm, corpo, errs } = separar(txt, rel);
  const titulo = corpo.match(/^# (.+)$/m)?.[1]?.trim() ?? fm?.titulo ?? id;
  return { id, rel, fm: fm || {}, corpo, errs, titulo, secoes: secoes(corpo) };
}

export function gravarNo(raiz, id, fm, corpo) {
  const ord = {};
  for (const k of ORDEM_FM) if (k in fm) ord[k] = fm[k];
  for (const k of Object.keys(fm)) if (!(k in ord)) ord[k] = fm[k];
  writeFileSync(caminhoNo(raiz, id), `---\n${dump(ord)}---${corpo.startsWith("\n") ? "" : "\n"}${corpo}`);
}
