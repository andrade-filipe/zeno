// vista.mjs — zeno vista --obsidian [--check] [--saida <dir>]: o grafo de trabalho do alvo como notas com links de wiki,
// numa pasta visível do alvo (o .agents/ é oculto). Só lê o ledger: sem trava e sem evento. A pasta leva um .gitignore
// com *, e cada nota o cabeçalho de gerado; a nota sem ele é de pessoa e nunca é sobrescrita; o que sai vai para _lixo/.
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, renameSync, realpathSync } from "node:fs";
import { join, resolve, relative, isAbsolute, dirname, basename, sep } from "node:path";
import { abrir } from "../sessao.mjs";
import { lerNo } from "../no.mjs";
import { modeloGrafo, notasObsidian, ehGerado, GITIGNORE } from "../grafo.mjs";
import { Recusa } from "../util.mjs";

const USO = "zeno vista --obsidian [--check] [--saida <dir>]";

// A saída fica dentro do alvo (D8 da grelha: o grafo de um alvo de empresa não cai no monorepo nem no vault), fora do
// .agents/ e do .git/. O symlink é resolvido pelo ancestral que existe.
function saidaDe(raiz, cwd, saida) {
  if (saida === true) throw new Recusa(2, "uso", USO);
  const d = saida === undefined ? join(raiz, "zeno-grafo") : resolve(cwd, String(saida));
  let x = d; const resto = [];
  while (!existsSync(x)) { resto.unshift(basename(x)); x = dirname(x); }
  const real = join(realpathSync(x), ...resto), rel = relative(realpathSync(raiz), real);
  const topo = rel.split(sep)[0];
  if (!rel || rel.startsWith("..") || isAbsolute(rel) || topo === ".agents" || topo === ".git") throw new Recusa(1, "saida", `a saída da vista fica dentro do alvo, fora do .agents/ e do .git/: ${saida ?? d}`);
  return real;
}

export async function vista(ctx, pos, o, reg) {
  if (!o.obsidian) throw new Recusa(2, "uso", USO);
  const S = reg(abrir(ctx, o, { escrever: false }));
  const dir = saidaDe(S.raiz, ctx.cwd, o.saida);
  const docs = new Map();
  for (const id of S.proj.nos.keys()) { const n = lerNo(S.raiz, id); docs.set(id, { titulo: n?.titulo ?? id, corpo: n?.corpo ?? "" }); }
  const notas = notasObsidian(modeloGrafo(S.proj.nos, S.cfg, docs), { alvo: S.cfg.alvo, ultimo: S.led.eventos.at(-1)?.id });
  const ler = (nome) => readFileSync(join(dir, nome), "utf8");
  const deriva = [], pessoa = [], sobra = [];
  for (const [nome, txt] of notas) {
    if (!existsSync(join(dir, nome))) deriva.push(nome);
    else if (!ehGerado(ler(nome))) pessoa.push(nome);
    else if (ler(nome) !== txt) deriva.push(nome);
  }
  if (existsSync(dir)) for (const nome of readdirSync(dir).sort()) if (nome.endsWith(".md") && !notas.has(nome) && ehGerado(ler(nome))) sobra.push(nome);
  const gi = existsSync(join(dir, ".gitignore")) ? ler(".gitignore") : null;
  const giAlheio = gi !== null && !gi.startsWith("# GERADO pelo zeno vista");
  const avisos = [
    ...pessoa.map((nome) => ({ regra: "vista", msg: `${nome} não tem o cabeçalho de gerado (nota de pessoa): não sobrescrita` })),
    ...(giAlheio ? [{ regra: "vista", msg: "a pasta já tem um .gitignore que não é do Zeno: não mexido; confira se as notas ficam fora do git" }] : []),
  ];
  const rel = relative(S.raiz, dir);
  if (o.check) {
    const muda = [...(gi === GITIGNORE || giAlheio ? [] : [".gitignore"]), ...deriva, ...sobra];
    return { codigo: muda.length ? 1 : 0, avisos, dados: { saida: rel, deriva: muda, pessoa },
      msg: muda.length ? `deriva em ${rel}/ (rode zeno vista --obsidian): ${muda.join(", ")}` : `${rel}/ em dia (${notas.size} notas)` };
  }
  mkdirSync(dir, { recursive: true });
  if (!giAlheio) writeFileSync(join(dir, ".gitignore"), GITIGNORE);
  for (const nome of deriva) writeFileSync(join(dir, nome), notas.get(nome));
  if (sobra.length) {
    const lixo = join(dir, "_lixo"); mkdirSync(lixo, { recursive: true });
    for (const nome of sobra) renameSync(join(dir, nome), join(lixo, existsSync(join(lixo, nome)) ? `${nome.slice(0, -3)}.${ctx.agora()}.md` : nome));
  }
  return { codigo: 0, avisos, dados: { saida: rel, notas: notas.size, escritas: deriva, lixo: sobra, pessoa },
    msg: `${rel}/: ${notas.size} notas, ${deriva.length} escritas, ${sobra.length} para _lixo/${pessoa.length ? `, ${pessoa.length} de pessoa puladas` : ""}` };
}
