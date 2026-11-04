// tela.mjs — como o Zeno escreve para a pessoa no terminal (D40, spec/tela.md): resumo antes do detalhe, rótulos numa
// coluna, quebra na largura do terminal com recuo, cor só em TTY e nada dito só pela cor. Sem dependência. A largura e a
// cor chegam por ctx (só o cli.mjs lê process.stdout.columns e NO_COLOR, T16).

export const largura = (ctx) => Math.max(60, Math.min(100, Number(ctx?.colunas) || 80));

// Estilos: identidade sem cor (pipe, --json, NO_COLOR). Com cor: negrito, vermelho, amarelo, fraco.
export function estilo(ctx, o = {}) {
  const ligado = !!ctx?.cor && !o.json;
  const sgr = (a, b) => (s) => (ligado ? `\x1b[${a}m${s}\x1b[${b}m` : String(s));
  return { negrito: sgr(1, 22), vermelho: sgr(31, 39), amarelo: sgr(33, 39), fraco: sgr(2, 22), ligado };
}
const visivel = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, "").length;

// Quebra por palavra. A 1ª linha tem `largura - inicio` colunas; as outras, `largura - recuo`. Palavra maior que a linha
// é cortada (um caminho longo não estoura a coluna).
export function quebrar(texto, larg, recuo = 0, inicio = recuo) {
  const out = []; let linha = "", cab = larg - inicio;
  for (let p of String(texto ?? "").replace(/\s+/g, " ").trim().split(" ")) {
    while (p.length > larg - recuo) { if (linha) { out.push(linha); linha = ""; cab = larg - recuo; } out.push(p.slice(0, cab)); p = p.slice(cab); cab = larg - recuo; }
    if (!linha) linha = p;
    else if (linha.length + 1 + p.length <= cab) linha += " " + p;
    else { out.push(linha); linha = p; cab = larg - recuo; }
  }
  if (linha || !out.length) out.push(linha);
  return out.map((l, i) => (i === 0 ? l : " ".repeat(recuo) + l));
}

// Corta no fim de uma palavra, com reticência, para caber em n colunas.
export function cortar(s, n) {
  s = String(s ?? "");
  if (s.length <= n) return s;
  const c = s.slice(0, n - 1), e = c.lastIndexOf(" ");
  return (e > n * 0.4 ? c.slice(0, e) : c).replace(/[\s,;:·-]+$/, "") + "…";
}

// Pares [rótulo, valor] com os rótulos numa coluna. Valor lista (array) vira itens numerados.
export function rotulado(pares, larg, margem = 3) {
  const w = Math.max(...pares.map(([r]) => visivel(r))) + 2, recuo = margem + w, out = [];
  for (const [r, v] of pares) {
    const pre = " ".repeat(margem) + r + " ".repeat(w - visivel(r));
    if (Array.isArray(v)) {
      v.forEach((it, i) => { const ls = quebrar(`${i + 1}. ${it}`, larg, recuo + 3, recuo); out.push((i === 0 ? pre : " ".repeat(recuo)) + ls[0], ...ls.slice(1)); });
    } else { const ls = quebrar(v, larg, recuo, recuo); out.push(pre + ls[0], ...ls.slice(1)); }
  }
  return out;
}

// Tabela: colunas alinhadas pelo maior valor; a última coluna é cortada para caber na largura.
export function tabela(cab, linhas, larg, margem = 1) {
  const todas = [cab, ...linhas], n = cab.length;
  const ws = cab.map((_, j) => Math.max(...todas.map((l) => visivel(l[j] ?? ""))));
  const fixo = margem + ws.slice(0, n - 1).reduce((a, b) => a + b + 2, 0);
  return todas.map((l) => " ".repeat(margem) + l.map((c, j) => {
    const s = String(c ?? "");
    if (j === n - 1) return cortar(s, Math.max(10, larg - fixo));
    return s + " ".repeat(ws[j] - visivel(s));
  }).join("  ").replace(/\s+$/, ""));
}

// "── texto ─────" na largura.
export function cabecalho(texto, larg, est = estilo()) {
  const t = cortar(texto, larg - 6);
  return est.negrito(`── ${t} ${"─".repeat(Math.max(3, larg - visivel(t) - 4))}`);
}
// Alinhado à direita (o sha discreto no fim do item).
export const direita = (s, larg, est = estilo()) => " ".repeat(Math.max(0, larg - visivel(s))) + est.fraco(s);
