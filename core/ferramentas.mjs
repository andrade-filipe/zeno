// ferramentas.mjs — as ferramentas de terminal do SDLC de um alvo: detectar, ensinar (cartão no contexto, skill sob
// demanda) e conferir presença e login sem ler segredo (T107; degraus 1 e 2 da escada "ensinar antes de integrar").
// Conferir login roda só a tabela fixa abaixo, pelo ctx.sondar do cli.mjs, que descarta a saída: só o código de saída
// volta. Nenhum nome vindo de config chega a um shell; a presença no PATH é procurada aqui, sem shell.
import { existsSync, readFileSync, readdirSync, accessSync, constants } from "node:fs";
import { join, delimiter } from "node:path";
import { lista } from "./util.mjs";

// A tabela fixa. login: argumentos de um comando de status (só o código de saída é lido), ou o motivo de não conferir.
const SEGREDO = "não dá para saber sem ler segredo";
export const FERRAMENTAS = Object.freeze({
  git: { bin: "git", skill: "git", login: "não se aplica (a credencial é do helper do git)" },
  gh: { bin: "gh", skill: "gh", login: (host) => ["auth", "status", "--hostname", host], host: "github.com" },
  glab: { bin: "glab", skill: "glab", login: (host) => ["auth", "status", "--hostname", host] },
  docker: { bin: "docker", skill: "containers", login: SEGREDO, servico: ["info"] },
  podman: { bin: "podman", skill: "containers", login: SEGREDO, servico: ["info"] },
  testes: { skill: "testes" },
});
const NOME_BIN = /^[A-Za-z0-9._+-]{1,64}$/;

// Presença no PATH, sem shell (o nome pode vir de um check do sistema.yaml).
export function noPath(bin, env = {}) {
  if (!NOME_BIN.test(String(bin))) return false;
  for (const d of String(env.PATH || "").split(delimiter).filter(Boolean)) {
    try { accessSync(join(d, bin), constants.X_OK); return true; } catch {}
  }
  return false;
}

// Os hosts dos remotos do git: git@host:caminho, ssh://[user@]host[:porta]/…, https://[user@]host/…
export function hostsDosRemotos(ctx, raiz) {
  const r = ctx.git ? ctx.git(["remote", "-v"], { cwd: raiz }) : null;
  if (!r || r.status !== 0) return [];
  const hosts = new Set();
  for (const l of String(r.stdout || "").split("\n")) {
    const url = l.split(/\s+/)[1] || "";
    const m = url.match(/^[a-z+]+:\/\/(?:[^@/]+@)?([^/:]+)/i) || url.match(/^(?:[^@/]+@)?([^/:]+):/);
    if (m) hosts.add(m[1].toLowerCase());
  }
  return [...hosts];
}

const CONTAINER = /^(Dockerfile|Containerfile|(docker-)?compose[^/]*\.ya?ml)$/;

// As ferramentas do alvo: a chave ferramentas: do sistema.yaml (editada pela pessoa) sobrescreve; sem ela, detecção.
export function detectar(ctx, raiz, cfg) {
  const declaradas = lista(cfg.ferramentas).filter((f) => FERRAMENTAS[f]);
  if (lista(cfg.ferramentas).length) return declaradas;
  const env = ctx.env || {}, out = [];
  // dentro de um repo git (o alvo pode ser uma subpasta do repo, como o zeno/ no monorepo)
  if (ctx.git && ctx.git(["rev-parse", "--is-inside-work-tree"], { cwd: raiz }).status === 0) out.push("git");
  const hosts = out.includes("git") ? hostsDosRemotos(ctx, raiz) : [];
  if (hosts.includes("github.com")) out.push("gh");
  if (hosts.some((h) => h.includes("gitlab"))) out.push("glab");
  let arqs = [];
  try { arqs = readdirSync(raiz); } catch {}
  if (arqs.some((f) => CONTAINER.test(f))) {
    const ha = ["docker", "podman"].filter((b) => noPath(b, env));
    out.push(...(ha.length ? ha : ["docker"]));
  }
  if (Object.keys(cfg.checks || {}).length) out.push("testes");
  return out;
}

const dirDe = (mod, skill) => join(mod.dir, "ferramentas", skill);

// O bloco "Ferramentas deste alvo" do contexto: os cartões (um por skill) e o caminho de cada skill inteira.
export function blocoDoContexto(mod, nomes) {
  const skills = [...new Set(nomes.map((n) => FERRAMENTAS[n]?.skill).filter(Boolean))];
  if (!skills.length) return "";
  const partes = skills.map((s) => {
    const p = join(dirDe(mod, s), "cartao.md");
    const cartao = existsSync(p) ? readFileSync(p, "utf8").trim() : "";
    return `${cartao}\nGuia completo: ${join(dirDe(mod, s), "SKILL.md")}`;
  });
  return `## Ferramentas deste alvo (${nomes.join(", ")})\n\n${partes.join("\n\n")}\n`;
}

// Confere cada ferramenta. Dentro do zeno sessao (marcador), o login de fora não aparece: não confere e avisa.
export function conferir(ctx, raiz, cfg, nomes) {
  const env = ctx.env || {}, sandbox = !!ctx.marcador, hosts = hostsDosRemotos(ctx, raiz);
  const sondar = (bin, args) => {
    if (!ctx.sondar) return null;
    const r = ctx.sondar(bin, args);
    return r && Number.isInteger(r.status) ? r.status : null;
  };
  return nomes.map((nome) => {
    const f = FERRAMENTAS[nome], avisos = [];
    if (nome === "testes") {
      const cmds = Object.entries(cfg.checks || {}).map(([k, v]) => ({ check: k, bin: String(v?.cmd ?? v ?? "").trim().split(/\s+/)[0] }));
      const faltam = cmds.filter((c) => !noPath(c.bin, env)).map((c) => c.check);
      if (faltam.length) avisos.push(`o comando destes checks não está no PATH: ${faltam.join(", ")}`);
      return { nome, presente: cmds.length > 0 && !faltam.length, login: "não se aplica", checks: cmds.map((c) => c.check), avisos };
    }
    const presente = noPath(f.bin, env);
    let login = "não conferido";
    if (!presente) login = "não conferido (ausente)";
    else if (typeof f.login === "string") login = f.login;
    else if (sandbox) { login = "não conferido (dentro do sandbox)"; avisos.push("dentro do zeno sessao o login de fora não aparece"); }
    else {
      const host = f.host || hosts.find((h) => h.includes("gitlab"));
      if (!host) login = "não conferido (sem host)";
      else { const s = sondar(f.bin, f.login(host)); login = s === 0 ? `sim (${host})` : s === null ? "não deu para conferir" : `não (${host})`; }
    }
    const r = { nome, presente, login, avisos };
    if (f.servico) { const s = presente ? sondar(f.bin, f.servico) : null; r.servico = !presente ? "—" : s === 0 ? "de pé" : s === null ? "não deu para conferir" : "parado"; }
    return r;
  });
}
