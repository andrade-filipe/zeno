// mensagens.mjs — o fio de um nó: 7 tipos, campos obrigatórios, lint (spec/mensagens.md).
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { semAcento, ehAgente } from "./util.mjs";

export const TIPOS_MSG = {
  pedido: { obr: ["objetivo", "saida", "ferramentas", "fronteira", "parada", "checagem"], opc: ["prazo", "orcamento", "clausula"] },
  pergunta: { obr: ["contexto", "opcoes", "recomendacao", "bloqueia"], opc: [] },
  resposta: { obr: ["responde-a", "resposta"], opc: ["porque"] },
  decisao: { obr: ["o-que", "porque", "alternativas", "quem-decidiu"], opc: [] },
  entrega: { obr: ["o-que", "evidencia", "desfazer"], opc: ["ref"] },
  escalada: { obr: ["travou", "tentado", "precisa"], opc: [] },
  aviso: { obr: ["o-que"], opc: ["acao"] },
};
const MAX = 2000;
export const CLAUSULA = "não contorne negações nem guardas; se algo for negado, pare e escale.";

export function lerFio(path, deId = (x) => x) {   // deId: hash → pessoa (T73)
  if (!existsSync(path)) return [];
  const msgs = [];
  let cur = null;
  readFileSync(path, "utf8").split("\n").forEach((l, k) => {
    const h = l.match(/^### (m-\S+) · (\S+) · (\S+) · (\S+) → (.+?)\s*$/);
    if (h) { cur = { id: h[1], tipo: h[2], ts: h[3], de: deId(h[4]), para: h[5].split(",").map((s) => deId(s.trim())), campos: {}, linha: k + 1, extras: [] }; msgs.push(cur); return; }
    if (!cur || !l.trim()) return;
    const m = l.match(/^- \*\*([a-z-]+):\*\* (.*)$/);
    if (m) cur.campos[m[1]] = m[1] === "quem-decidiu" ? deId(m[2]) : m[2]; else cur.extras.push(k + 1);
  });
  return msgs;
}

export function formatar(m) {
  return `### ${m.id} · ${m.tipo} · ${m.ts} · ${m.de} → ${m.para.join(", ")}\n` +
    Object.entries(m.campos).map(([k, v]) => `- **${k}:** ${String(v).replace(/\s*\n\s*/g, " ")}`).join("\n") + "\n\n";
}
export const acrescentarFio = (path, m) => appendFileSync(path, formatar(m));

// Lint (T: deliberadamente raso). opts.molde: mensagem escrita pela própria CLI (sem "autossuficiente").
export function lint(m, { cfg, msgsDoFio = [], existeNo = () => true, termos = [], molde = false, envio = true }) {
  const v = [];
  const def = TIPOS_MSG[m.tipo];
  if (!def) return [{ regra: "tipo", msg: `tipo desconhecido: ${m.tipo}` }];
  for (const c of def.obr) if (/*G:lint-msg*/ (!m.campos[c] || !String(m.campos[c]).trim())) v.push({ regra: "campos", campo: c, msg: `falta o campo obrigatório: ${c}` });
  const permitidos = new Set([...def.obr, ...def.opc, "responde-a"]);
  for (const c of Object.keys(m.campos)) if (!permitidos.has(c)) v.push({ regra: "campos", campo: c, msg: `campo fora do tipo ${m.tipo}: ${c}` });
  if (!m.para.length || !m.para[0]) v.push({ regra: "para", msg: "sem destinatário" });
  for (const d of m.para) if (d && !d.startsWith("cliente:") && !(d in (cfg.pessoas || {})) && !cfg.agentes.includes(d) && !ehAgente(d)) v.push({ regra: "para", msg: `destinatário desconhecido: ${d}` });
  const ra = m.campos["responde-a"];
  if (ra && !msgsDoFio.some((x) => x.id === ra)) v.push({ regra: "responde-a", msg: `responde-a aponta para mensagem inexistente: ${ra}` });
  const qd = m.campos["quem-decidiu"];
  if (qd && qd in (cfg.pessoas || {}) && qd !== m.de) v.push({ regra: "pessoa", msg: `quem-decidiu (${qd}) tem de ser quem escreve (${m.de})` });
  if (envio && !molde) {
    const vazios = new Set(termos.map((t) => semAcento(t).toLowerCase().trim()));
    for (const [c, val] of Object.entries(m.campos)) if (vazios.has(semAcento(val).toLowerCase().replace(/[.!]+$/, "").trim())) v.push({ regra: "autossuficiente", campo: c, msg: `o campo ${c} não se explica sozinho ("${val}")` });
  }
  for (const [c, val] of Object.entries(m.campos)) {
    if (String(val).length > MAX) v.push({ regra: "tamanho", campo: c, msg: `o campo ${c} passa de ${MAX} caracteres` });
    for (const [, alvo] of String(val).matchAll(/\[\[([^\]|#]+)/g)) if (!existeNo(alvo.trim())) v.push({ regra: "links", msg: `link para nó inexistente: [[${alvo}]]` });
  }
  return v;
}

// Caixa: mensagens para dest sem resposta (responde-a). Para pessoa, só resposta de pessoa conta.
export function pendentesDe(msgs, dest, cfg) {
  const ehP = dest in (cfg.pessoas || {});
  return msgs.filter((m) => m.para.includes(dest) && !msgs.some((r) => r.campos["responde-a"] === m.id && (!ehP || r.de in cfg.pessoas)));
}
