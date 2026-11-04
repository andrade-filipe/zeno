// vista.mjs — o gate humano como a pessoa o lê (D40): tipo (tirado do diff do ref, não de quem escreve), nível de risco
// (declarado no cartão), MUDOU, sha e o cartão por campo. A mesma vista vai para a tela e para o --json (D39: outra porta
// renderiza do jeito dela).
import { lerNo, chaves, shaArtefato } from "./no.mjs";
import { TITULO_FASE } from "./util.mjs";
import { quebrar, rotulado, tabela, cabecalho, direita, cortar } from "./tela.mjs";

export const NIVEIS = ["alto", "baixo", "nenhum"];
// "alto: texto" → { nivel: "alto", texto: "texto" }; sem o prefixo (cartão de antes da D40), nivel null
export function nivelDoRisco(v) {
  const m = String(v ?? "").match(/^\s*(alto|baixo|nenhum)\s*[:·—-]\s*/i);
  return m ? { nivel: m[1].toLowerCase(), texto: String(v).slice(m[0].length).trim() } : { nivel: null, texto: String(v ?? "").trim() };
}
// "(1) a; (2) b" ou "a; b" → ["a", "b"]
export function itensDoConferir(v) {
  const s = String(v ?? "").trim();
  if (/\(\d\)/.test(s)) return s.split(/\(\d\)\s*/).map((x) => x.trim().replace(/[;,]\s*$/, "").trim()).filter(Boolean);
  return s.split(";").map((x) => x.trim()).filter(Boolean);
}
export function cartaoCampos(secao) {
  const ks = chaves(secao);
  if (!["muda", "porque", "risco", "desfazer", "reprovar", "conferir"].some((k) => ks[`cartao-${k}`])) return null;
  const r = nivelDoRisco(ks["cartao-risco"]);
  return { muda: ks["cartao-muda"] ?? "(falta)", porque: ks["cartao-porque"] ?? "(falta)", risco: r.texto || "(falta)", nivel: r.nivel,
    desfazer: ks["cartao-desfazer"] ?? "(falta)", reprovar: ks["cartao-reprovar"] ?? "(falta)", conferir: itensDoConferir(ks["cartao-conferir"]) };
}

const SHA = /\b[0-9a-f]{7,40}\b/g;
const SEGURANCA = /(^|\/)(guardas\.json|seguranca\.md)$|(^|\/)core\/(shell|protegidos|seccomp|proxy|assinatura)\.mjs$|(^|\/)core\/verbos\/(guarda|lancar)\.mjs$|(^|\/)\.githooks\//;
// Tipo da mudança, pelo diff dos commits do ref da Entrega: segurança (guarda, shell, protegidos, seguranca.md, hooks de
// git, ou uma guarda /*G:*/ nova), docs (só .md fora do .agents/), código (o resto), registro (sem commit: Especificação,
// retro, ou só nós do .agents/).
export function tipoDaMudanca(S, n, fase) {
  if (fase !== "entrega") return "registro";
  const shas = [...new Set(String(chaves(n.secoes.out.entrega || "").ref || "").match(SHA) || [])];
  const arqs = []; let guarda = false;
  for (const c of shas) {
    const r = S.ctx.git(["show", "--format=", "--name-only", c], { cwd: S.raiz });
    if (r.status !== 0) continue;
    arqs.push(...r.stdout.split("\n").filter(Boolean));
    if (/^\+.*\/\*G:[a-z0-9-]+\*\//m.test(S.ctx.git(["show", "--format=", "-U0", c], { cwd: S.raiz }).stdout || "")) guarda = true;
  }
  const fora = arqs.filter((a) => !/(^|\/)\.agents\//.test(a));
  if (!fora.length) return "registro";
  if (guarda || fora.some((a) => SEGURANCA.test(a))) return "segurança";
  if (fora.every((a) => a.endsWith(".md"))) return "docs";
  return "código";
}

export function vistaGate(S, st, { mudou = false } = {}) {
  const n = lerNo(S.raiz, st.id), f = st.gate_aberto.fase, c = cartaoCampos(n.secoes.out[f]);
  const ref = f === "entrega" ? String(chaves(n.secoes.out.entrega || "").ref || "").trim() : "";
  return { no: st.id, fase: f, titulo: n.titulo, tipo: tipoDaMudanca(S, n, f), nivel: c?.nivel ?? null, mudou, sha: shaArtefato(n.corpo, f), ref,
    cartao: c, resumo: c ? null : Object.entries(chaves(n.secoes.out[f])).map(([k, v]) => `${k}: ${v}`).join(" | ") };
}
// Pede olho: risco alto, segurança, MUDOU, ou cartão sem nível declarado (de antes da D40)
export const pedeOlho = (v) => /*G:caixa-abre-o-que-importa*/ (v.nivel === "alto" || v.nivel === null || v.tipo === "segurança" || v.mudou);
const rotNivel = (v) => (v.nivel === "alto" ? "ALTO" : v.nivel ?? "?");

export function resumoCaixa(vs, quem, larg, est) {
  const altos = vs.filter((v) => v.nivel === "alto").length, mud = vs.filter((v) => v.mudou).length;
  const cab = `Caixa de ${quem} · ${vs.length} gate${vs.length === 1 ? "" : "s"} · ${altos} de risco alto · ${mud} ${mud === 1 ? "mudou" : "mudaram"}`;
  const linhas = tabela(["#", "fase", "tipo", "risco", "gate"], vs.map((v, i) => [String(i + 1), TITULO_FASE[v.fase], v.tipo, rotNivel(v), (v.mudou ? "⚠ MUDOU · " : "") + v.titulo]), larg);
  if (est.ligado) linhas.forEach((l, i) => { if (i === 0) linhas[i] = est.fraco(l); else linhas[i] = l.replace(/  ALTO  /, `  ${est.vermelho("ALTO")}  `).replace("⚠ MUDOU", est.amarelo("⚠ MUDOU")); });
  return [est.negrito(cab), "", ...linhas];
}

export function detalheGate(v, i, larg, est) {
  const out = [cabecalho(`${i} · ${TITULO_FASE[v.fase]} · ${v.titulo}`, larg, est)];
  if (v.mudou) out.push(...quebrar("⚠ MUDOU desde que o gate abriu: confira o texto; fica fora do \"todos\" (só por número)", larg, 5, 3).map((l, j) => (j ? l : "   " + est.amarelo(l))));
  if (v.cartao) {
    const c = v.cartao, risco = v.nivel ? `${rotNivel(v)} · ${c.risco}` : c.risco;
    const ls = rotulado([["Muda", c.muda], ["Porquê", c.porque], ["Risco", risco], ["Desfazer", c.desfazer], ["Reprovar", c.reprovar], ["Conferir", c.conferir.length ? c.conferir : ["(falta)"]]], larg);
    out.push(...ls.map((l) => (est.ligado && /^ {3}Risco +ALTO ·/.test(l) ? l.replace("ALTO", est.vermelho("ALTO")) : l)));
  } else out.push(...quebrar(`(sem cartão) ${v.resumo}`, larg, 3, 3).map((l, j) => (j ? l : "   " + l)));
  out.push(direita(`${v.no}${v.ref ? ` · ref ${cortar(v.ref, 30)}` : ""} · sha ${v.sha.slice(0, 8)}`, larg, est));
  return out;
}
