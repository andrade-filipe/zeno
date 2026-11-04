// pessoas.mjs — pessoas em hash no disco, em alvo de fronteira empresa/cliente (T73, D35).
// A tradução é só na borda: na memória, a CLI usa o id da pessoa; no disco (ledger, fio, vista do nó e as chaves de
// pessoas do sistema.yaml) vai h:<8 hex> de sha256(sal + ":" + id). O sal e a lista de nomes do alvo moram fora do git,
// em ~/.config/zeno/sal/<alvo>.sal (1ª linha: o sal; demais: um nome por linha) — decisões do Filipe, 2026-11-02.
// Alvo pessoal: identidade, byte a byte igual a antes.
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { sha256, ehAgente, Recusa } from "./util.mjs";

export const caminhoSal = (home, alvo) => join(home, ".config", "zeno", "sal", `${alvo}.sal`);
export const hasheia = (cfg) => cfg.fronteira === "empresa" || cfg.fronteira === "cliente";
export const hashDe = (sal, id) => `h:${sha256(`${sal}:${id}`).slice(0, 8)}`;

// Cria o sal do alvo (se falta) e põe a pessoa na lista local. Devolve o sal.
export function garantirSal(home, alvo, pessoa) {
  const p = caminhoSal(home, alvo);
  if (!existsSync(p)) {
    mkdirSync(dirname(p), { recursive: true, mode: 0o700 });
    writeFileSync(p, randomBytes(32).toString("hex") + "\n", { mode: 0o600 });
  }
  const [sal, ...nomes] = readFileSync(p, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  if (pessoa && !nomes.includes(pessoa)) appendFileSync(p, pessoa + "\n");
  return sal;
}

const id = (x) => x;
const IDENT = { ativo: false, h: id, deId: id, paraDisco: id, deDisco: id, msgParaDisco: id, fmParaDisco: id, cfgDeDisco: id };

// Devolve o tradutor do alvo. Sem sal num alvo que hasheia: recusa (fail-closed; nada é escrito em claro).
export function tradutor(cfg, home) {
  if (!/*G:pessoas-hash*/ hasheia(cfg)) return IDENT;
  const p = caminhoSal(home, cfg.alvo);
  if (!existsSync(p)) throw new Recusa(1, "pessoas-hash", `alvo de fronteira ${cfg.fronteira} sem o sal das pessoas (${p}): só quem instalou o tem; nada foi escrito`);
  const [sal, ...nomes] = readFileSync(p, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  const h = (x) => (typeof x !== "string" || !x || ehAgente(x) || x.startsWith("h:") ? x : hashDe(sal, x));
  const volta = new Map(nomes.map((n) => [hashDe(sal, n), n]));
  const deId = (x) => (typeof x === "string" && volta.has(x) ? volta.get(x) : x);
  // os campos de pessoa de cada evento (spec/ledger.md)
  const campos = (e, f) => {
    const o = { ...e, ator: f(e.ator) };
    if (e.assinatura) o.assinatura = { ...e.assinatura, pessoa: f(e.assinatura.pessoa) };
    if (e.dados) {
      const x = { ...e.dados };
      for (const k of ["dono", "revisor", "executor"]) if (k in x) x[k] = f(x[k]);
      if (Array.isArray(x.pessoas)) x.pessoas = x.pessoas.map(f);
      if (Array.isArray(x.para)) x.para = x.para.map(f);
      if (x.decisor?.tipo === "humano") x.decisor = { ...x.decisor, id: f(x.decisor.id) };
      if (e.ev === "ajuste" && ["dono", "revisor", "executor"].includes(x.campo)) { x.antes = f(x.antes); x.depois = f(x.depois); }
      o.dados = x;
    }
    return o;
  };
  return {
    ativo: true, h, deId,
    paraDisco: (e) => campos(e, h),
    deDisco: (e) => Object.assign(e, campos(e, deId)),   // no lugar: guarda o _linha não enumerável
    msgParaDisco: (m) => ({ ...m, de: h(m.de), para: (m.para || []).map(h), campos: { ...m.campos, ...("quem-decidiu" in (m.campos || {}) ? { "quem-decidiu": h(m.campos["quem-decidiu"]) } : {}) } }),
    fmParaDisco: (fm) => { const o = { ...fm }; for (const k of ["dono", "revisor", "executor"]) if (k in o) o[k] = h(o[k]); return o; },
    // sistema.yaml: as chaves de pessoas e o padrão de papéis estão em hash no disco; na memória, voltam a nome
    cfgDeDisco: (cfg) => {
      cfg.pessoas = Object.fromEntries(Object.entries(cfg.pessoas || {}).map(([k, v]) => [deId(k), v]));
      for (const k of ["dono", "revisor"]) if (cfg.padraoPapeis?.[k]) cfg.padraoPapeis[k] = deId(cfg.padraoPapeis[k]);
      return cfg;
    },
  };
}
