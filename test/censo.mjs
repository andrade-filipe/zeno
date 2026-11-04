#!/usr/bin/env node
// censo.mjs — prova de cada guarda ativa do guardas.json (D33): o probe passa no zeno/ real, e numa cópia temporária com
// o marcador /*G:id*/ trocado por false&& o probe FALHA. O zeno/ real nunca é mutado. Uso: node test/censo.mjs [id …] [--json]
// Não é arquivo de teste (o node --test dos hooks roda só *.test.mjs).
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ZENO = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), json = args.includes("--json"), so = args.filter((a) => !a.startsWith("--"));
const reg = JSON.parse(readFileSync(join(ZENO, "guardas.json"), "utf8"));
const ativas = reg.guardas.filter((g) => g.estado === "ativa" && (!so.length || so.includes(g.id)));
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_") && k !== "NODE_TEST_CONTEXT"));
const PULAR = new Set(["_lixo", "node_modules", ".git", ".agents", ".claude", "spec"]);

const rodarProbe = (raiz, probe) => spawnSync(process.execPath, ["--test", probe], { cwd: raiz, encoding: "utf8", env, timeout: 60000 });

// Censo de marcadores: todo /*G:id*/ do core tem guarda ativa, e toda guarda ativa tem marcador.
function marcadores() {
  const achados = new Map();
  const walk = (d) => { for (const x of readdirSync(d)) { if (PULAR.has(x) || x === "test") continue; const p = join(d, x); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".mjs")) for (const [, id] of readFileSync(p, "utf8").matchAll(/\/\*G:([a-z0-9-]+)\*\//g)) (achados.get(id) || achados.set(id, new Set()).get(id)).add(relative(ZENO, p)); } };
  walk(ZENO);
  return achados;
}

const res = [], probl = [];
const mk = marcadores();
for (const id of mk.keys()) if (!reg.guardas.some((g) => g.id === id && g.estado === "ativa")) probl.push(`marcador sem guarda ativa: ${id}`);
for (const g of ativas) {
  const r = { id: g.id, base: null, mutante: null, trocas: 0, veredito: "FAIL", motivo: "" };
  res.push(r);
  for (const c of g.caminhos) if (!existsSync(join(ZENO, c))) { r.motivo = `caminho não existe: ${c}`; break; }
  if (r.motivo) continue;
  if (!existsSync(join(ZENO, g.probe))) { r.motivo = `probe não existe: ${g.probe}`; continue; }
  const b = rodarProbe(ZENO, g.probe);
  r.base = b.status;
  if (b.status !== 0) { r.motivo = "o probe falha no zeno/ real"; continue; }
  const tmp = mkdtempSync(join(tmpdir(), `zeno-censo-${g.id}-`));
  try {
    cpSync(ZENO, tmp, { recursive: true, filter: (src) => !PULAR.has(src.split("/").pop()) || src === ZENO });
    for (const c of g.caminhos) {
      const p = join(tmp, c), t = readFileSync(p, "utf8"), n = t.split(g.mutacao.marcador).length - 1;
      r.trocas += n;
      writeFileSync(p, t.split(g.mutacao.marcador).join(g.mutacao.por));
    }
    if (!r.trocas) { r.motivo = `marcador ${g.mutacao.marcador} não achado nos caminhos`; continue; }
    const m = rodarProbe(tmp, g.probe);
    r.mutante = m.status;
    if (m.status === 0) r.motivo = "a mutação sobreviveu: o probe passa com a guarda desligada";
    else r.veredito = "PASS";
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

const pass = res.filter((r) => r.veredito === "PASS").length;
const adiadas = reg.guardas.filter((g) => g.estado !== "ativa").map((g) => g.id);
if (json) process.stdout.write(JSON.stringify({ v: 1, pass, fail: res.length - pass, problemas: probl, resultados: res, adiadas }) + "\n");
else {
  for (const r of res) process.stdout.write(`${r.veredito}  ${r.id.padEnd(20)} trocas ${r.trocas}  probe real ${r.base}  mutante ${r.mutante}${r.motivo ? "  " + r.motivo : ""}\n`);
  for (const p of probl) process.stdout.write(`FAIL  ${p}\n`);
  process.stdout.write(`censo: ${pass}/${res.length} guardas mortas pela mutação; adiadas: ${adiadas.join(", ") || "—"}\n`);
}
process.exitCode = pass === res.length && !probl.length ? 0 : 1;
