// protegidos.mjs — a lista única do que o agente não edita por ferramenta de arquivo (T69).
// A camada 1 (permissions.deny, gerada pelo sync) e a camada 2 (o hook pre-tool de Edit/Write) leem daqui.
import { existsSync, realpathSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";

// T97: .agents/githooks/** (o gate de commit do alvo) é gerado e protegido como o settings.
export const PROT = [".agents/ledger.jsonl", ".agents/trabalho/*.fio.md", ".agents/gerados.lock", ".agents/sistema.yaml", ".agents/faixas.yaml", ".agents/githooks/**", "CLAUDE.md", ".claude/**"];
// T74: num alvo adotado (o settings.json é do repo), o Zeno protege só o que é dele e o settings do repo e o local
// (decisão do Filipe); CLAUDE.md, AGENTS.md e o resto de .claude/ ficam com as regras do próprio repo.
// T94: a adoção é um fato gravado pelo install (adocao: true), e não depende de o repo ter um settings.json; os alvos
// adotados antes da T94 (sem o campo) seguem reconhecidos pelo settings.json no local.
export const adotado = (cfg) => cfg.adocao === true || (cfg.local || []).includes(".claude/settings.json");
// T113: num alvo pessoal adotado sem settings.json próprio, a fiação do Zeno é o .claude/settings.json versionado (um
// clone novo já nasce com as travas e a deixa); fronteira empresa/cliente, settings.json do repo ou `fiacao: local` no
// sistema.yaml deixam a fiação no settings.local.json, por máquina.
export const fiacaoVersionada = (cfg) => adotado(cfg) && (cfg.fronteira || "pessoal") === "pessoal" && !(cfg.local || []).includes(".claude/settings.json") && cfg.fiacao !== "local";
const DO_ZENO = [".agents/ledger.jsonl", ".agents/trabalho/*.fio.md", ".agents/gerados.lock", ".agents/sistema.yaml", ".agents/faixas.yaml", ".agents/githooks/**"];
export const protegidos = (cfg) => [
  ...(adotado(cfg) ? [...DO_ZENO, ".claude/settings.json", ".claude/settings.local.json"] : PROT), // T81: a adoção não gera skill
  ...cfg.negarEscrita.map((d) => `${d.replace(/\/+$/, "")}/**`),
];

// o caminho real: segue symlinks do maior ancestral que existe (o arquivo a criar pode não existir ainda)
export function real(p) {
  let cab = p, resto = [];
  while (!existsSync(cab) && dirname(cab) !== cab) { resto.unshift(basename(cab)); cab = dirname(cab); }
  try { return join(realpathSync(cab), ...resto); } catch { return p; }
}
const reDe = (glob) => new RegExp("^" + glob.split(/(\*\*|\*)/).map((x) => (x === "**" ? ".*" : x === "*" ? "[^/]*" : x.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))).join("") + "$");

// Devolve o padrão protegido que casa com o arquivo, ou null. `arquivo` absoluto ou relativo a `cwd`.
export function arquivoProtegido(raiz, cfg, arquivo, cwd = raiz) {
  const alvo = real(resolve(cwd, String(arquivo))), r = real(raiz);
  for (const g of protegidos(cfg)) if (reDe(resolve(r, g)).test(alvo)) return g;
  return null;
}
