// yaml.mjs — subconjunto de YAML do motor do hub (conhecimento/schema/hub.mjs), COPIADO e adaptado (D3/D7: nada é importado).
// Adaptações: a chave aceita "." (ex.: entrega.push-main); o escape "\x" das aspas duplas volta a "x"; há um dump simétrico.
// Fora do subconjunto: lista de mapas, âncoras, multilinha, "{}" inline.

function scalar(raw, ln, errs, file) {
  let s = raw.trim();
  if (/^\[\[/.test(s)) { errs.push([file, ln, "yaml", `wikilink no frontmatter precisa de aspas: "${s}"`]); return s; }
  if (s.startsWith("[")) {
    s = s.replace(/\]\s+#.*$/, "]");
    if (!s.endsWith("]")) { errs.push([file, ln, "yaml", "lista inline sem ']'"]); return []; }
    const items = []; let cur = "", q = null, quoted = false;
    for (let k = 1; k < s.length - 1; k++) {
      const c = s[k];
      if (q) { if (q === '"' && c === "\\") { cur += s[++k]; continue; } if (c === q) q = null; else cur += c; continue; }
      if ((c === '"' || c === "'") && !cur.trim()) { cur = ""; q = c; quoted = true; continue; } // espaço antes da aspa não é valor
      if (quoted && /\s/.test(c)) continue; // nem depois dela
      if (c === ",") { items.push(quoted ? cur : cur.trim()); cur = ""; quoted = false; continue; }
      cur += c;
    }
    if (cur.trim() || quoted) items.push(quoted ? cur : cur.trim());
    return items;
  }
  if (s[0] === '"' || s[0] === "'") {
    const q = s[0]; let k = 1;
    for (; k < s.length; k++) {
      if (q === '"' && s[k] === "\\") { k++; continue; }
      if (s[k] === q) { if (q === "'" && s[k + 1] === "'") { k++; continue; } break; }
    }
    if (k >= s.length) { errs.push([file, ln, "yaml", "aspas sem fechar"]); return s; }
    if (s.slice(k + 1).trim() && !/^\s+#/.test(s.slice(k + 1))) errs.push([file, ln, "yaml", `texto depois das aspas: ${s.slice(k + 1).trim()}`]);
    const v = s.slice(1, k);
    return q === '"' ? v.replace(/\\(.)/g, "$1") : v.replace(/''/g, "'");
  }
  if (s.startsWith("#")) return null;
  s = s.replace(/\s+#.*$/, "");
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "" || s === "~" || s === "null") return null;
  return s;
}

function yaml(lines, l0, file, errs) {
  const L = lines.map((t, i) => ({ t, ln: l0 + i, ind: t.match(/^ */)[0].length })).filter((x) => x.t.trim() && !/^\s*#/.test(x.t));
  for (const x of L) if (/^\t/.test(x.t)) errs.push([file, x.ln, "yaml", "tab na indentação"]);
  let i = 0;
  const block = (ind) => {
    const obj = {};
    while (i < L.length && L[i].ind === ind) {
      const { t, ln } = L[i];
      // chave simples, ou entre aspas duplas sem escape (T73: "h:1a2b3c4d" nas pessoas de alvo empresa/cliente)
      const m = t.trim().match(/^(?:([A-Za-z_][\w.-]*)|"([^"\\]+)"):(?:\s+(.*))?$/);
      if (!m) { errs.push([file, ln, "yaml", `linha fora do subconjunto: "${t.trim()}"`]); i++; continue; }
      const k = m[1] ?? m[2], rest = m[3];
      if (k in obj) errs.push([file, ln, "yaml", `chave duplicada: ${k}`]);
      i++;
      if (rest !== undefined && rest.trim() !== "") { obj[k] = scalar(rest, ln, errs, file); continue; }
      if (i < L.length && L[i].ind > ind && L[i].t.trim().startsWith("- ")) {
        const li = L[i].ind, list = [];
        while (i < L.length && L[i].ind === li && L[i].t.trim().startsWith("- ")) {
          const item = L[i].t.trim().slice(2);
          if (/^[A-Za-z_][\w.-]*:\s/.test(item)) errs.push([file, L[i].ln, "yaml", "lista de mapas não é suportada"]);
          list.push(scalar(item, L[i].ln, errs, file)); i++;
        }
        obj[k] = list;
      } else if (i < L.length && L[i].ind > ind) obj[k] = block(L[i].ind);
      else obj[k] = null;
    }
    return obj;
  };
  const r = L.length ? block(L[0].ind) : {};
  if (i < L.length) errs.push([file, L[i].ln, "yaml", "indentação inconsistente"]);
  return r;
}

export function parseYaml(text, file = "") {
  const errs = [];
  const obj = yaml(String(text).replace(/\r\n/g, "\n").split("\n"), 1, file, errs);
  return { obj, errs };
}

// Frontmatter: "---" na 1ª linha, fecha com "---". Devolve o corpo como texto.
export function separar(txt, file = "") {
  const lines = String(txt).replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "---") return { fm: null, corpo: lines.join("\n"), errs: [[file, 1, "yaml", "sem frontmatter"]] };
  const end = lines.indexOf("---", 1);
  if (end < 0) return { fm: null, corpo: "", errs: [[file, 1, "yaml", "frontmatter sem '---' de fechamento"]] };
  const errs = [];
  const fm = yaml(lines.slice(1, end), 2, file, errs);
  return { fm, corpo: lines.slice(end + 1).join("\n"), errs };
}

const PRECISA_ASPAS = /^$|^[\s\[\]{}"'#&*!|>%@`]|^- |: | #|,|\s$|^(true|false|null|~)$/;
function escalar(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  const s = String(v);
  return PRECISA_ASPAS.test(s) ? JSON.stringify(s) : s;
}

// dump: escalares, listas inline, mapas aninhados (mapa vazio vira null: o subconjunto não tem "{}").
export function dump(obj, ind = 0) {
  const pad = " ".repeat(ind);
  let out = "";
  for (const [k0, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    const k = /^[A-Za-z_][\w.-]*$/.test(k0) ? k0 : JSON.stringify(k0);   // chave fora do simples sai entre aspas (T73)
    if (Array.isArray(v)) out += `${pad}${k}: [${v.map(escalar).join(", ")}]\n`;
    else if (v && typeof v === "object") {
      const vals = Object.entries(v).filter(([, x]) => x !== undefined);
      out += vals.length ? `${pad}${k}:\n${dump(Object.fromEntries(vals), ind + 2)}` : `${pad}${k}: null\n`;
    } else out += `${pad}${k}: ${escalar(v)}\n`;
  }
  return out;
}
