// portao-ajuda.mjs — fixture do portão de publicação (T118): um monorepo falso (zeno/ e docs/) num diretório temporário,
// um clone público que é um repo git temporário, uma lista de nomes inventada na casa de teste e uma cópia do root
// falsa. O monorepo é um repo git de verdade, com um commit (o snapshot sai do commit); só o git log do zeno/ é fingido
// (LOG), e o tar roda de verdade. Nada aqui toca a lista real nem um clone real.
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readdirSync, readFileSync, statSync, symlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { alvo, raizTmp, gitReal, gitFalso } from "./ajuda.mjs";
import { uid } from "./raiz-root.mjs";
import { DOCS } from "../core/portao.mjs";

export const LOG = "abc1234\tfeat(zeno): o portão de publicação\ndef5678\tfix(zeno): um conserto\n";
const escrever = (base, arqs) => { for (const [f, t] of Object.entries(arqs)) { mkdirSync(dirname(join(base, f)), { recursive: true }); writeFileSync(join(base, f), t); } };

// nomes: as linhas da lista (null: sem lista); gitleaks: "limpo", "acha" ou "ausente"; root: a cópia do root ativa;
// ignorar: linhas do .gitignore do monorepo; depois: arquivos escritos no zeno/ depois do commit (fora dele)
export async function montarPortao({ nomes = ["acme", "cliente-x"], gitleaks = "limpo", root = true, extra = {}, sem = [], ignorar = [], depois = {} } = {}) {
  const A = await alvo();
  const mono = mkdtempSync(join(raizTmp(), "zeno-mono-")), src = join(mono, "zeno"), pub = join(mkdtempSync(join(raizTmp(), "zeno-pub-")), "publico");
  const arqs = {
    "cli.mjs": "// zeno\n", "core/run.mjs": "// run\n", "guardas.json": "{}\n",
    "README.md": "# Zeno\n\n- [comece](../docs/comecar.md) · [o placar](../avaliacao/placar.md) · [a spec](spec/cli.md#verbos)\n",
    "spec/cli.md": "# CLI\n\nVeja o [glossário](../../docs/glossario.md).\n",
    LICENSE: "Apache License 2.0\n", NOTICE: "Zeno\n", "CONTRIBUTING.md": "# Contribuir\n", "SECURITY.md": "# Segurança\n",
    ".agents/ledger.jsonl": "{}\n", ".claude/settings.json": "{}\n", "CLAUDE.md": "@AGENTS.md\n", "_lixo/velho.md": "velho\n", ".githooks/pre-commit": "#!/bin/sh\n",
    ...(typeof extra === "function" ? extra(A) : extra),
  };
  for (const s of sem) delete arqs[s];
  escrever(src, arqs);
  // T119: as frases de layout do monorepo que o portão troca (o PATH do clone, o shim, o bloco do placar com a saída)
  const LAYOUT_MONO = "\nNo clone do `context-engineering`:\n\n```sh executavel\nexport PATH=\"$CE/zeno/bin:$PATH\"\nln -s <caminho do clone>/zeno/bin/zeno ~/bin/zeno\n```\n\nO shim `zeno/bin/zeno`; `zeno promover --de <caminho do clone>/zeno`.\n\n```sh executavel\nnode \"$CE/avaliacao/placar/placar.mjs\" --ledger x\n```\n```text saida\n# Placar do Zeno\n```\n\nFim.\n";
  escrever(join(mono, "docs"), Object.fromEntries(DOCS.map((p) => [p, `# ${p}\n\n[a CLI](${p.includes("/") ? "../../" : "../"}zeno/spec/cli.md) · [o hub](../conhecimento/README.md)\n${LAYOUT_MONO}`])));
  if (ignorar.length) writeFileSync(join(mono, ".gitignore"), ignorar.join("\n") + "\n");
  for (const a of [["init", "-q", "-b", "main"], ["add", "-A"], ["commit", "-q", "-m", "fixture"]]) gitReal(a, { cwd: mono });
  const commit = gitReal(["rev-parse", "HEAD"], { cwd: mono }).stdout.trim();
  escrever(src, depois);
  mkdirSync(pub); gitReal(["init", "-q", "-b", "main"], { cwd: pub });
  if (nomes) { mkdirSync(join(A.home, ".config", "zeno"), { recursive: true }); writeFileSync(join(A.home, ".config", "zeno", "portao-nomes.txt"), nomes.join("\n") + "\n"); }
  const raiz = mkdtempSync(join(raizTmp(), "zeno-opt-"));
  chmodSync(raiz, 0o755);
  if (root) { mkdirSync(join(raiz, "000000000000")); symlinkSync(join(raiz, "000000000000"), join(raiz, "atual")); }
  const falso = gitFalso({ commit, log: LOG });
  const git = (args, o) => (args[0] === "log" && !o.cwd.startsWith(pub) ? falso(args, o) : gitReal(args, o));
  // a prova (bwrap) e o gitleaks são fingidos; o resto (o tar do snapshot) roda de verdade
  const rodar = (cmd, { cwd }) => {
    if (cmd.startsWith("gitleaks")) return { status: gitleaks === "acha" ? 1 : 0, ms: 1, stdout: "" };
    if (cmd.startsWith("bwrap")) return { status: 0, ms: 1, stdout: "" };
    const r = spawnSync("sh", ["-c", cmd], { cwd, encoding: "utf8" });
    return { status: r.status ?? 1, ms: 1, stdout: (r.stdout || "") + (r.stderr || "") };
  };
  const which = (b) => b === "gitleaks" && gitleaks !== "ausente";
  const ctx = { git, rodar, which, root: { raiz, uid: uid(), sudo: "" } };
  return {
    A, mono, src, pub, raiz, ctx, commit,
    publicar: (quem = "pessoa", over = {}) => A.z(["promover", "--de", src, "--publicar", pub], quem, { ...ctx, ...over }),
    // o clone inteiro (arquivos e refs), para provar que o portão reprovado não escreveu nada
    digital: () => JSON.stringify([listarTudo(pub), gitReal(["for-each-ref"], { cwd: pub }).stdout]),
    ler: (f) => readFileSync(join(pub, f), "utf8"),
  };
}

function listarTudo(d, pre = "") {
  return readdirSync(join(d, pre)).filter((x) => !(pre === "" && x === ".git")).sort().flatMap((x) => {
    const rel = pre ? `${pre}/${x}` : x;
    return statSync(join(d, rel)).isDirectory() ? listarTudo(d, rel) : [`${rel}:${readFileSync(join(d, rel), "utf8").length}`];
  });
}

// o portão reprovou só o check `id`, com 1, e o clone ficou igual
export function reprovouSo(assert, r, id, antes, P) {
  assert.equal(r.codigo, 1, r.stdout + r.stderr);
  assert.equal(r.j.erros[0].regra, "portao");
  const reprovados = [...r.stderr.matchAll(/REPROVA +(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(reprovados, [id], r.stderr);
  assert.equal(P.digital(), antes, "o portão reprovado não escreve no clone");
}
