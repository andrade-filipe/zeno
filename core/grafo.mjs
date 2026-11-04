// grafo.mjs — o modelo único da vista do grafo de trabalho (H9, D10): nós, arestas e tags, a partir da projeção. Puro: não
// lê disco nem processo. O render do Obsidian (zeno vista --obsidian) fica por cima; o vista --json poderá reusar o modelo.
import { faixaEfetiva } from "./projecao.mjs";

// nos: a projeção (Map id → estado); docs: Map id → { titulo, corpo } do arquivo do nó.
export function modeloGrafo(nos, cfg, docs) {
  const local = (x) => typeof x === "string" && nos.has(x);
  const lista = [...nos.values()].map((st) => {
    const d = docs.get(st.id) || {};
    const corpo = String(d.corpo || "");
    const cita = [...nos.keys()].filter((id) => id !== st.id && new RegExp(`(?<![a-z0-9-])${id}(?![a-z0-9-])`).test(corpo));
    return {
      id: st.id, titulo: d.titulo || st.id, corpo,
      pai: st.pai ?? null, paiLocal: local(st.pai),
      filhos: [...nos.values()].filter((n) => n.pai === st.id).map((n) => n.id),
      depende: (st.depende_de || []).map((x) => ({ id: x, local: local(x) })),
      cita,
      tags: [`zeno/fase/${st.fase}`, `zeno/tamanho/${st.tamanho}`, `zeno/faixa/${faixaEfetiva(st, nos, cfg)}`, `zeno/estado/${st.estado}`],
      fase: st.fase,
    };
  });
  const porFase = {};
  for (const n of lista) porFase[n.fase] = (porFase[n.fase] || 0) + 1;
  return { nos: lista, raizes: lista.filter((n) => !n.paiLocal).map((n) => n.id), porFase };
}

export const GERADO_POR = "zeno vista --obsidian";
export const GITIGNORE = `# GERADO pelo ${GERADO_POR}; não edite\n*\n`;
// A nota é do Zeno só se o frontmatter traz o cabeçalho de gerado; a nota de pessoa nunca é sobrescrita nem movida.
export function ehGerado(txt) {
  const s = String(txt);
  if (!s.startsWith("---\n")) return false;
  const fim = s.indexOf("\n---", 3);
  return fim > 0 && s.slice(0, fim).split("\n").includes(`gerado_por: ${GERADO_POR}`);
}

const link = (id) => `[[${id}]]`;
const cabecalho = (ultimo, extra = []) => ["---", `gerado_por: ${GERADO_POR}`, "fonte: .agents/ledger.jsonl", `ledger_ultimo: ${ultimo ?? "nenhum"}`, ...extra, "---",
  `<!-- GERADO pelo ${GERADO_POR}; não edite -->`];

// O render do Obsidian: Map nome do arquivo → texto. Um <id>.md por nó e o _indice.md.
export function notasObsidian(m, { alvo, ultimo }) {
  const out = new Map(), titulo = new Map(m.nos.map((n) => [n.id, n.titulo]));
  for (const n of m.nos) {
    const corpo = n.corpo.replace(/^\s*# .*\n?/, "").replace(/^\n+/, "");
    const linhas = [
      ...cabecalho(ultimo, [`tags: [${n.tags.join(", ")}]`, `aliases: [${JSON.stringify(n.titulo)}]`]),
      `# ${n.titulo}`, "",
      `- pai: ${n.pai === null ? "—" : n.paiLocal ? link(n.pai) : n.pai}`,
      `- filhos: ${n.filhos.map(link).join(", ") || "—"}`,
      `- depende de: ${n.depende.map((d) => (d.local ? link(d.id) : d.id)).join(", ") || "—"}`,
      `- cita: ${n.cita.map(link).join(", ") || "—"}`, "",
      corpo.trimEnd(),
    ];
    out.set(`${n.id}.md`, linhas.join("\n") + "\n");
  }
  const indice = [
    ...cabecalho(ultimo), `# Grafo de trabalho: ${alvo}`, "",
    `${m.nos.length} nós. Por fase: ${Object.entries(m.porFase).map(([f, k]) => `${f} ${k}`).join(", ") || "—"}.`, "",
    "## Raízes", "", ...m.raizes.map((id) => `- ${link(id)} — ${titulo.get(id)}`),
  ];
  out.set("_indice.md", indice.join("\n") + "\n");
  return out;
}
