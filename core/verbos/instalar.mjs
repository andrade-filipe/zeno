// instalar.mjs — install e sync (spec/instalacao.md). O alvo leva só dados; os gerados saem do canônico, num sentido só.
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, appendFileSync, renameSync, rmdirSync, statSync, chmodSync } from "node:fs";
import { join, resolve, basename, dirname, relative, isAbsolute } from "node:path";
import { protegidos, adotado, fiacaoVersionada } from "../protegidos.mjs";
import { hasheia, hashDe, garantirSal, caminhoSal } from "../pessoas.mjs";
import { abrir, ev, gravar } from "../sessao.mjs";
import { caminhoChave } from "../assinatura.mjs";
import { P, ZENO_DIR, carregar, MCP_ESCRITA } from "../config.mjs";
import { sha256, slug, semAcento, lista, Recusa } from "../util.mjs";
import { registrarAlvo, fronteiraDaRegra, maisRestrita } from "../alvos.mjs";

const CAB_MD = (fonte) => `<!-- GERADO pelo zeno sync; não edite. Fonte: ${fonte} -->`;

// T97: a camada 4 do alvo. Os hooks de commit vão em .agents/githooks/ (versionados, no lock, protegidos); o sync liga o
// core.hooksPath do clone só quando ele está vazio e não há hook ativo. Falha fechado: sem zeno, o commit para.
const GITHOOKS = ["pre-commit", "pre-merge-commit"];
const HOOK_GIT = (versao) => `#!/bin/sh
# GERADO pelo zeno sync; não edite. Fonte: zeno/modulos/nucleo@${versao} (T97)
# A camada 4 do alvo: o commit só passa com o ledger coerente e os gerados sem deriva.
# Desligar neste clone: git config --unset core.hooksPath (e o zeno sync --check passa a acusar).
if [ -n "\${GIT_DIR:-}" ]; then GIT_DIR="$(cd "$GIT_DIR" && pwd)"; GIT_WORK_TREE="$(git rev-parse --show-toplevel)"; export GIT_DIR GIT_WORK_TREE; fi
cd "$(dirname "$0")/../.." || exit 1
juiz=""
if [ -f "$HOME/.local/share/zeno/atual/cli.mjs" ]; then juiz="$HOME/.local/share/zeno/atual/cli.mjs"; fi
if [ -f /opt/zeno/atual/cli.mjs ]; then juiz=/opt/zeno/atual/cli.mjs; fi
if [ -n "$juiz" ]; then
  node "$juiz" validar --staged && node "$juiz" sync --check
elif command -v zeno >/dev/null 2>&1; then
  zeno validar --staged && zeno sync --check
else
  echo "zeno: sem o zeno, o gate de commit deste clone falha fechado (git config --unset core.hooksPath o desliga)" >&2
  exit 1
fi
`;
const HARNESS = ["CLAUDE.md", ".claude/settings.json", ".claude/settings.local.json", ".mcp.json"];

// T77: na adoção, `local` declara todo o harness que já existia: o rol HARNESS, cada item de .claude/ (cada skill de
// .claude/skills/), bench/, scripts/ e os .md da raiz. O AGENTS.md fica fora: é do repo, e o Zeno mantém só o bloco dele.
function harnessExistente(dir, existentes) {
  const ls = (d) => { try { return readdirSync(join(dir, d), { withFileTypes: true }); } catch { return []; } };
  const out = [...existentes], por = (rel, e) => { const r = rel + (e.isDirectory() ? "/" : ""); if (!out.includes(rel) && !out.includes(r)) out.push(r); };
  for (const e of ls(".claude")) if (e.isDirectory() && e.name === "skills") for (const s of ls(".claude/skills")) por(`.claude/skills/${s.name}`, s); else por(`.claude/${e.name}`, e);
  for (const d of ["bench", "scripts"]) for (const e of ls(".").filter((x) => x.name === d)) por(d, e);
  for (const e of ls(".")) if (e.isFile() && e.name.endsWith(".md") && e.name !== "AGENTS.md") por(e.name, e);
  return out;
}

// T77: num worktree ligado, o nome do alvo vem do checkout principal (git-common-dir), não da pasta do worktree
function nomeDoAlvo(ctx, dir) {
  const r = ctx.git(["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir", "--show-prefix"], { cwd: dir });
  const [g, c, pre = ""] = r.status === 0 ? r.stdout.split("\n") : [];
  if (!g || !c || !isAbsolute(c) || g === c) return slug(basename(dir)) || "alvo";
  if (basename(c) !== ".git") throw new Recusa(2, "uso", `${dir} está num worktree ligado e não achei o checkout principal (${c}): passe --alvo-nome`);
  return slug(basename(join(dirname(c), pre))) || "alvo";
}

export async function install(ctx, pos, o, reg) {
  const dir = resolve(ctx.cwd, pos[0] || ".");
  if (existsSync(P(dir).sistema)) throw new Recusa(1, "install", `já instalado em ${dir}`);
  const existentes = HARNESS.filter((f) => existsSync(join(dir, f)));
  if (existentes.length && !o.adocao) throw new Recusa(1, "install", `o alvo já tem harness (${existentes.join(", ")}): use --adocao`);
  const nome = ctx.git(["config", "user.name"], { cwd: dir }).stdout?.trim() || "pessoa";
  const email = ctx.git(["config", "user.email"], { cwd: dir }).stdout?.trim() || "";
  const pessoa = o.pessoa || slug(semAcento(nome).split(/\s+/)[0]) || "pessoa";
  const fronteira = o.fronteira || "pessoal";
  if (!["pessoal", "empresa", "cliente"].includes(fronteira)) throw new Recusa(2, "uso", `fronteira desconhecida: ${fronteira}`);
  const alvo = o["alvo-nome"] || nomeDoAlvo(ctx, dir);
  const versao = carregarModulo().versao;
  const p = P(dir);
  mkdirSync(p.trabalho, { recursive: true });
  const yl = (xs) => (xs.length ? `[${xs.map((x) => JSON.stringify(x)).join(", ")}]` : "[]");
  // T73: em empresa/cliente, nenhuma pessoa em claro no que é commitado; o sal e o nome ficam fora do git
  const hz = hasheia({ fronteira });
  const pk = hz ? JSON.stringify(hashDe(garantirSal(ctx.home, alvo, pessoa), pessoa)) : pessoa;
  const git = hz ? `git_sha256: ${JSON.stringify(email ? sha256(email) : "")}` : `git: ${JSON.stringify(email)}`;
  writeFileSync(p.sistema, `# Composição do Zeno neste alvo (spec/instalacao.md). Canônico: editado por pessoa.
zeno: 1
alvo: ${alvo}
fronteira: ${fronteira}
modulos:
  nucleo: ${versao}
pessoas:
  ${pk}:
    ${git}
    chave_pub: null
agentes: [ia:claude]
padrao:
  dono: ${pk}
  revisor: ${pk}
delegacao_padrao:
  ferramentas: "as permitidas no .claude/settings.json do alvo"
  fronteira: "só este alvo"
  parada: "o próximo gate, ou o orçamento"
  checagem: "reler o pronto antes de começar"
checks: null
checks_padrao: []
limites:
  P_linhas: 80
orcamento:
  teto_diario:
    usd: 0
    tokens: null
negar_escrita: ${yl(lista(o.negar ? String(o.negar).split(",") : []))}
${o.adocao ? "# adoção (T94): as regras do Zeno vão no .claude/settings.local.json, fora do git, tenha o repo um settings.json ou não\nadocao: true\n" : ""}${o.adocao ? "# local: o harness que já existia (adoção, T77); o AGENTS.md é do repo, e o Zeno mantém só o bloco zeno:inicio/fim\n" : ""}local: ${yl(o.adocao ? harnessExistente(dir, existentes) : existentes)}
gerar:
  claude: true
`);
  writeFileSync(p.faixas, readFileSync(join(ZENO_DIR, "modulos", "nucleo", "faixas.yaml"), "utf8").replace(/^#.*\n/, "# Tabela de faixas do alvo. Começa igual ao piso do módulo nucleo; uma linha local só aperta (spec/controle.md).\n"));
  if (!existsSync(p.ledger)) writeFileSync(p.ledger, "");
  writeFileSync(join(p.agents, ".gitattributes"), "ledger.jsonl merge=union\ntrabalho/*.fio.md merge=union\n");
  writeFileSync(join(p.agents, ".gitignore"), ".zeno.lock\n.zeno.lock.*\n");
  const S = reg(abrir({ ...ctx, cwd: dir }, {}));
  ev(S, "install.executado", null, { fronteira, modo: o.adocao ? "adocao" : "novo", modulos: { nucleo: versao }, locais: existentes.length, sync: !o["sem-sync"] });
  const eventos = gravar(S);
  let msg = `instalado em ${dir} (${o.adocao ? "adoção" : "novo"}; pessoa ${pessoa}; fronteira ${fronteira})`;
  if (hz) msg += `\npessoas em hash no disco (T73); o sal e os nomes ficam só nesta máquina: ${caminhoSal(ctx.home, alvo)}`;
  // T112: a chave_pub nasce null; a dica só confere se o arquivo da chave existe (não o abre), e o install não grava a chave
  msg += existsSync(caminhoChave(ctx.home || "", pessoa))
    ? `\nchave_pub de ${pessoa} vazia: nenhum gate humano se decide; rode zeno chave pub e cole a linha na sua pessoa em .agents/sistema.yaml`
    : `\nchave_pub de ${pessoa} vazia: nenhum gate humano se decide; rode zeno chave nova e cole a linha que ele mostra na sua pessoa em .agents/sistema.yaml`;
  // T104: o install registra o alvo na lista da máquina (fora do git); falhar aqui só avisa, porque o registro não guarda nada
  const avisos = [], rg = registrarAlvo(ctx, dir, alvo);
  msg += "\n" + rg.msg;
  if (!rg.ok) avisos.push({ regra: "registro", msg: rg.msg });
  // H21: pela regra por pasta, ou sem regra nenhuma, este alvo vale mais restrito do que a fronteira gravada
  const regra = fronteiraDaRegra(ctx, dir).fronteira, efetiva = maisRestrita(fronteira, regra) ?? fronteira;
  if (efetiva !== fronteira) avisos.push({ regra: "fronteira", msg: `a regra por pasta diz ${regra}, e o alvo foi gravado como ${fronteira}: a frota o trata como ${efetiva}; para gravar igual, reinstale com --fronteira ${efetiva}` });
  else if (!o.fronteira && !regra) avisos.push({ regra: "fronteira", msg: `sem --fronteira e sem regra por pasta, gravei ${fronteira} (o padrão do install); se o repo não é seu, reinstale com --fronteira cliente ou empresa` });
  if (!o["sem-sync"]) { const r = await sincronizar(S, {}); msg += "\n" + r.msg; if (r.codigo) return { ...r, msg, avisos: [...avisos, ...(r.avisos || [])], eventos: [...eventos, ...(r.eventos || [])] }; }
  else { const r = await sincronizar(S, { soAgents: true }); msg += "\n" + r.msg; }
  return { codigo: 0, msg, avisos, eventos };
}

function carregarModulo() {
  const t = readFileSync(join(ZENO_DIR, "modulos", "nucleo", "modulo.yaml"), "utf8");
  return { versao: t.match(/^versao:\s*(\S+)/m)[1] };
}

// O que o sync gera (em memória). Devolve [{rel, conteudo, fonte}] e erros de plano.
export function planoSync(S, { soAgents = false } = {}) {
  const { cfg, raiz } = S, mod = cfg.nucleo, out = [], erros = [], avisos = [];
  if (cfg.modulos.nucleo && String(cfg.modulos.nucleo) !== String(mod.versao)) erros.push(["versao", `o alvo fixa nucleo ${cfg.modulos.nucleo}, o zeno tem ${mod.versao} (atualizar é modulo.atualizar)`]);
  // AGENTS.md: bloco gerado entre marcadores; o resto é manual e fica byte a byte
  const agentsPath = join(raiz, "AGENTS.md");
  let ag = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : `# ${cfg.alvo}\n\n<!-- Parte manual: escreva aqui. O bloco do Zeno abaixo é gerado. -->\n`;
  const frag = readFileSync(join(mod.dir, mod.agents_md), "utf8").trim();
  const bloco = `<!-- zeno:inicio nucleo -->\n${CAB_MD(`zeno/modulos/nucleo@${mod.versao}`)}\n${frag}\n<!-- zeno:fim nucleo -->`;
  const re = /<!-- zeno:inicio nucleo -->[\s\S]*?<!-- zeno:fim nucleo -->/;
  // T83 (D39): na adoção com a porta do Claude Code (settings.local.json gerado), o bloco vai junto com as travas, pelo
  // SessionStart; o AGENTS.md commitado volta a ser só do repo (o bloco de adoções antigas sai, o resto fica byte a byte)
  const pelaPorta = !soAgents && cfg.gerar.claude !== false && adotado(cfg) && !cfg.local.includes(".claude/settings.local.json");
  if (/*G:bloco-pela-porta*/ pelaPorta) {
    if (existsSync(agentsPath) && re.test(ag)) out.push({ rel: "AGENTS.md", conteudo: ag.replace(/\n*<!-- zeno:inicio nucleo -->[\s\S]*?<!-- zeno:fim nucleo -->\n?/, "\n"), fonte: "sem bloco (adoção, T83)", bloco: true });
  } else {
    ag = re.test(ag) ? ag.replace(re, bloco) : ag.replace(/\n*$/, "\n\n") + bloco + "\n";
    out.push({ rel: "AGENTS.md", conteudo: ag, fonte: `bloco nucleo@${mod.versao}`, bloco: true });
  }
  // T97: antes do settings, para o deny de .agents/githooks/** casar com o que vai existir
  if (!soAgents && cfg.gerar.githooks !== false) for (const h of GITHOOKS) out.push({ rel: `.agents/githooks/${h}`, conteudo: HOOK_GIT(mod.versao), fonte: `nucleo@${mod.versao} (T97)`, modo: 0o755 });
  if (!soAgents && cfg.gerar.claude !== false) {
    // T94: um repo adotado sem settings.json não ganha CLAUDE.md (o AGENTS.md é do repo; o bloco vai pelo SessionStart).
    // T113: o settings.json dele só nasce na fiação versionada (pessoal, sem `fiacao: local`); senão, o settings.local.json
    const semHarnessVersionado = adotado(cfg) && !cfg.local.includes(".claude/settings.json");
    if (!semHarnessVersionado && !cfg.local.includes("CLAUDE.md")) out.push({ rel: "CLAUDE.md", conteudo: `${CAB_MD("AGENTS.md")}\n@AGENTS.md\n`, fonte: "AGENTS.md" });
    if (!adotado(cfg)) {
      const { json, erros: e } = settings(S, out);
      erros.push(...e);
      out.push({ rel: ".claude/settings.json", conteudo: json, fonte: ".agents/sistema.yaml + .agents/faixas.yaml" });
    } else if (/*G:fiacao-versionada*/ fiacaoVersionada(cfg)) {
      // T113: pessoal adotado sem settings.json próprio: a fiação da adoção (com o SessionStart) vai versionada, e o
      // settings.local.json gerado antes vira órfão (vai para .agents/_lixo/). Num clone sem o zeno no PATH, ela nega
      // comando e edição, como no zeno/; a saída é `fiacao: local` no sistema.yaml.
      const { json, erros: e } = settings(S, out, { porta: true });
      erros.push(...e);
      out.push({ rel: ".claude/settings.json", conteudo: json, fonte: ".agents/sistema.yaml + .agents/faixas.yaml (adoção versionada, T113; bloco pelo SessionStart, T83)" });
    } else if (/*G:adocao-intacta*/ adotado(cfg)) {
      if (cfg.fronteira === "pessoal" && cfg.local.includes(".claude/settings.json") && cfg.fiacao !== "local") avisos.push({ regra: "fiacao", msg: "fiação por máquina: o .claude/settings.json é do repo, então as travas e a deixa do Zeno ficam no settings.local.json deste clone (um clone novo precisa de zeno sync); para calar, ponha fiacao: local no sistema.yaml" });
      // T74: adoção — o settings.json é do repo e fica intacto; as regras do Zeno vão no local (por máquina, fora do git)
      if (cfg.local.includes(".claude/settings.local.json")) erros.push(["adocao", "o alvo já tem .claude/settings.local.json manual: o Zeno não tem onde pôr deny e hooks sem sobrescrever; mova-o para _lixo/ ou junte à mão e rode de novo"]);
      else {
        const { json, erros: e } = settings(S, out, { porta: true });
        erros.push(...e);
        out.push({ rel: ".claude/settings.local.json", conteudo: json, fonte: ".agents/sistema.yaml + .agents/faixas.yaml (adoção, T74; bloco pelo SessionStart, T83)" });
      }
    }
    // T81: na adoção o .claude/ é do repo (o harness dele governa as skills): a skill chega pelo zeno contexto, do módulo
    for (const sk of adotado(cfg) ? [] : Object.keys(mod.skills || {})) {
      const txt = readFileSync(join(mod.dir, "skills", sk, "SKILL.md"), "utf8");
      const com = txt.replace(/^(---\n[\s\S]*?\n---\n)/, `$1${CAB_MD(`zeno/modulos/nucleo@${mod.versao}/skills/${sk}`)}\n`);
      out.push({ rel: `.claude/skills/zeno-${sk}/SKILL.md`, conteudo: com, fonte: `nucleo@${mod.versao}/skills/${sk}` });
    }
  }
  const lock = out.filter((f) => !f.bloco).map((f) => `${sha256(f.conteudo)}  ${f.rel}  ${f.fonte}`).sort().join("\n");
  out.push({ rel: ".agents/gerados.lock", conteudo: `# GERADO pelo zeno sync: sha256, caminho, fonte. É o cabeçalho dos gerados sem comentário (JSON).\n${lock}\n`, fonte: "zeno sync", lock: true });
  return { arquivos: out, erros, avisos };
}

function settings(S, planejados, { porta = false } = {}) {
  const { raiz, cfg } = S, erros = [];
  // T69: nada no settings depende de onde o checkout está. `/x` no settings do projeto = <diretório onde a sessão abre>/x
  // (docs do Claude Code); `..` não é documentado, então o que fica fora do alvo é só da camada 2 (hook de arquivo).
  // Só `Edit(...)`: as docs dizem que regra de caminho em `Write(...)` é aceita e nunca casa; `Edit` cobre Write/MultiEdit/NotebookEdit.
  const ancora = (rel) => (/*G:settings-portatil*/ true ? "/" + rel : "//" + resolve(raiz, rel).replace(/^\/+/, ""));
  const deny = [];
  for (const rel of protegidos(cfg)) {
    const base = rel.replace(/\/\*\*$/, "").replace(/\/\*[^/]*$/, "");
    const existe = existsSync(resolve(raiz, base)) || planejados.some((f) => f.rel === base || f.rel.startsWith(base + "/")) || [".claude", "CLAUDE.md", ".agents/trabalho", ".agents/gerados.lock"].includes(base) || base.startsWith(".claude/"); // .claude/ é do próprio sync; o git não leva pasta vazia: num clone, trabalho/ nasce no 1º novo
    if (/*G:deny-camada1*/ !existe) erros.push(["deny-camada1", `a regra de negação ${rel} não casa com nada que exista (${resolve(raiz, base)})`]);
    const norm = relative(raiz, resolve(raiz, rel));
    if (!norm.startsWith("..") && !isAbsolute(norm)) deny.push(`Edit(${ancora(norm)})`);
  }
  deny.push("Bash(rm:*)");
  // T99: camada 1 dos MCP que escrevem fora da máquina, menos os que o alvo ou um perfil de agentes: lista (o deny
  // venceria a allowlist); o hook do matcher mcp__.* (camada 2) nega o resto, inclusive o servidor novo
  const listados = new Set([...cfg.mcp, ...Object.values(cfg.perfis || {}).flatMap((p) => lista(p?.mcp))]);
  for (const s of MCP_ESCRITA) if (!listados.has(s)) deny.push(`mcp__${s}`);
  const fc = /*G:hook-fail-closed*/ true ? " || exit 2" : "";
  const json = JSON.stringify({
    permissions: { deny },
    hooks: {
      // T82: com sessao_obrigatoria, um hook só para toda ferramenta (o guarda nega tudo fora da fronteira do zeno sessao)
      PreToolUse: cfg.sessaoObrigatoria ? [{ matcher: "*", hooks: [{ type: "command", command: `zeno guarda pre-tool${fc}` }] }] : [
        { matcher: "Bash", hooks: [{ type: "command", command: `zeno guarda pre-tool${fc}` }] },
        { matcher: "Edit|Write|MultiEdit|NotebookEdit", hooks: [{ type: "command", command: `zeno guarda pre-tool${fc}` }] },
        { matcher: "mcp__.*", hooks: [{ type: "command", command: `zeno guarda pre-tool${fc}` }] }, // T99
      ],
      PostToolUse: [{ matcher: "WebFetch|WebSearch|mcp__.*", hooks: [{ type: "command", command: `zeno guarda contaminou${fc}` }] }],
      SessionEnd: [{ hooks: [{ type: "command", command: "zeno guarda fim-sessao || true" }] }],
      // T113: a deixa do hábito; `|| true` porque o Stop nunca impede a parada (só o block do próprio guarda pede o retro)
      Stop: [{ hooks: [{ type: "command", command: "zeno guarda parar || true" }] }],
      // T83: na adoção, o bloco do Zeno chega pelo mesmo arquivo das travas (a saída do SessionStart entra no contexto;
      // teto documentado de 10.000 caracteres; o bloco tem ~1,3 kB)
      ...(porta ? { SessionStart: [{ hooks: [{ type: "command", command: "zeno contexto --bloco" }] }] } : {}),
    },
  }, null, 2) + "\n";
  return { json, erros };
}

function lerLock(raiz) {
  const p = P(raiz).gerados;
  if (!existsSync(p)) return new Set();
  return new Set(readFileSync(p, "utf8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => l.split(/\s{2}/)[1]));
}

// T112: se o git já ignora o arquivo (um .gitignore que cobre), nada se escreve; num worktree ligado (git-dir ≠
// git-common-dir), o exclude é o do checkout principal, e a saída diz isso
function excludeDe(S) {
  const r = S.ctx.git(["rev-parse", "--path-format=absolute", "--git-common-dir", "--show-prefix", "--git-dir"], { cwd: S.raiz });
  const [c, pre = "", g = c] = r.status === 0 ? r.stdout.split("\n") : [];
  if (!c || !isAbsolute(c)) return null; // fora de um repositório git: não há commit de onde ficar fora
  const path = join(c, "info", "exclude"), linha = `/${pre}.claude/settings.local.json`;
  const txt = existsSync(path) ? readFileSync(path, "utf8") : "";
  // só as regras do repo contam: o ignore global da pessoa ficaria de fora em outra máquina
  const ignorado = S.ctx.git(["-c", "core.excludesFile=/dev/null", "check-ignore", "-q", "--no-index", ".claude/settings.local.json"], { cwd: S.raiz }).status === 0;
  return { path, linha, presente: txt.split("\n").includes(linha) || ignorado, antes: txt && !txt.endsWith("\n") ? "\n" : "", worktree: g !== c };
}

// T97: o core.hooksPath do clone (em qualquer escopo: um global também é "o repo já tem o seu"), os hooks ativos em
// .git/hooks e a marca zeno.githooks, que o sync grava quando liga. Fora de um repositório git: null.
function githooksDe(S) {
  const g = (args) => S.ctx.git(args, { cwd: S.raiz });
  const r = g(["rev-parse", "--path-format=absolute", "--git-common-dir", "--show-prefix"]);
  const [c, pre = ""] = r.status === 0 ? r.stdout.split("\n") : [];
  if (!c || !isAbsolute(c)) return null;
  const nosso = `${pre}.agents/githooks`;
  const atual = (g(["config", "--get", "core.hooksPath"]).stdout || "").trim();
  const ligou = (g(["config", "--local", "--get", "zeno.githooks"]).stdout || "").trim();
  const dir = join(c, "hooks");
  const ativos = existsSync(dir) ? readdirSync(dir).filter((n) => !n.endsWith(".sample")) : [];
  const livre = !atual && !ativos.length;
  // acusa: o Zeno ligou e o hooksPath saiu; ou o clone está livre e ainda não foi ligado
  const fora = /*G:githooks-saida*/ (ligou && atual !== nosso) || (livre && !ligou);
  return { nosso, atual, ligou, ativos, livre, fora, g };
}

// T106: a deriva de segurança é a que muda o que o agente pode fazer: as travas e os hooks da porta (settings, .mcp.json),
// o gate de commit (githooks) e a config local do clone (core.hooksPath, info/exclude). O resto (o bloco do AGENTS.md,
// o CLAUDE.md, as skills, o lock e os órfãos) é forma.
export const tipoDaDeriva = (rel) => (/^\.claude\/settings[^/]*\.json$|^\.mcp\.json$|^\.agents\/githooks\/|^\.git\//.test(rel) ? "seguranca" : "forma");
// T111: a pasta de githooks_encadeado (relativa ao alvo) cobre o gate se o pre-commit e o pre-merge-commit dela existem e
// chamam validar --staged e sync --check. Lê só o texto: não prova que o roteador do repo os chama (resíduo declarado).
// T116: ou chamam o gerado de mesmo nome (`sh|bash|exec … .agents/githooks/<nome>`), que já tem as duas checagens. Só
// conta linha de comando: o caminho num comentário não cobre.
export function chamaOGerado(txt, nome) {
  const re = new RegExp(`(?:^|[\\s;&|(])(?:sh|bash|exec)\\s+(?:(?:sh|bash)\\s+)?["']?(?:[^\\s"';&|]*/)?\\.agents/githooks/${nome}["']?(?=[\\s;&|)]|$)`);
  return String(txt).split("\n").some((l) => re.test(l.replace(/(^|\s)#.*$/, "")));
}
function encadeadoDe(raiz, pasta) {
  if (!pasta) return null;
  const falta = [];
  for (const nome of ["pre-commit", "pre-merge-commit"]) {
    const p = join(raiz, pasta, nome);
    if (!existsSync(p)) { falta.push(`${pasta}/${nome} não existe`); continue; }
    const txt = readFileSync(p, "utf8"), sem = chamaOGerado(txt, nome) ? [] : ["validar --staged", "sync --check"].filter((c) => !txt.includes(c));
    if (sem.length) falta.push(`${pasta}/${nome} não chama ${sem.join(" nem ")}`);
  }
  return { pasta, falta };
}

export async function sincronizar(S, { check = false, soAgents = false } = {}) {
  const { raiz, cfg, ctx } = S;
  const { arquivos, erros, avisos: avisosDoPlano } = planoSync(S, { soAgents });
  if (erros.length) return { codigo: 1, msg: erros.map(([r, m]) => `${r}: ${m}`).join("\n"), erros: erros.map(([regra, msg]) => ({ regra, msg })) };
  const deriva = [];
  for (const f of arquivos) {
    const p = join(raiz, f.rel);
    const atual = existsSync(p) ? readFileSync(p, "utf8") : null;
    if (/*G:deriva*/ atual !== f.conteudo) deriva.push(f.rel);
    else if (f.modo && !(statSync(p).mode & 0o100)) deriva.push(f.rel); // T97: hook sem o bit de execução o git ignora
  }
  // T97: o gate de commit do clone (local, fora do git). Num repo com hooks próprios, não toca: avisa como encadear.
  const gh = arquivos.some((f) => f.rel.startsWith(".agents/githooks/")) ? githooksDe(S) : null;
  const avisos = [...avisosDoPlano];
  if (gh?.fora) deriva.push(".git/config core.hooksPath");
  // T111: githooks_encadeado (a pessoa, no sistema.yaml) declara a pasta dos hooks que já rodam o gate; o sync confere o texto
  const enc = gh && !gh.ligou && !gh.livre && gh.atual !== gh.nosso ? encadeadoDe(raiz, cfg.githooksEncadeado) : null;
  let coberto = null;
  if (enc && !enc.falta.length) coberto = `gate de commit coberto por ${enc.pasta}/pre-commit e pre-merge-commit (githooks_encadeado)`;
  else if (enc) avisos.push({ regra: "githooks", msg: `githooks_encadeado: ${enc.pasta} não cobre o gate de commit: ${enc.falta.join("; ")}; o gate do Zeno não foi ligado` });
  else if (gh && !gh.ligou && !gh.livre && gh.atual !== gh.nosso) avisos.push({ regra: "githooks", msg: `o clone já tem hooks (${gh.atual ? `core.hooksPath=${gh.atual}` : `.git/hooks: ${gh.ativos.join(", ")}`}): o gate de commit do Zeno não foi ligado; encadeie no seu pre-commit e pre-merge-commit: sh ${gh.nosso}/pre-commit` });
  if (gh?.ligou && gh.atual !== gh.nosso && gh.atual) avisos.push({ regra: "githooks", msg: `o core.hooksPath saiu de ${gh.nosso} para ${gh.atual}: volte com git config core.hooksPath ${gh.nosso}, ou aceite a saída com git config --unset zeno.githooks` });
  // T77: o settings.local.json da adoção fica fora do git pelo info/exclude do clone (local, não versionado), sem tocar o harness do repo
  const ex = arquivos.some((f) => f.rel === ".claude/settings.local.json") ? excludeDe(S) : null;
  if (ex && !ex.presente) deriva.push(".git/info/exclude");
  // T81: gerado que está no lock e saiu do plano (a zeno-* de adoções antigas) é órfão: o sync o move para .agents/_lixo/
  // o que está em `local` é manual (a pessoa assumiu o arquivo): nunca é órfão, mesmo que o Zeno o tenha gerado antes
  const manual = (rel) => cfg.local.some((l) => rel === l || (l.endsWith("/") && rel.startsWith(l)));
  const orfaos = soAgents ? [] : [...lerLock(raiz)].filter((rel) => !arquivos.some((f) => f.rel === rel) && !manual(rel) && existsSync(join(raiz, rel)));
  deriva.push(...orfaos);
  if (check) {
    // T106: o tipo de cada deriva; a de segurança vem primeiro e segue saindo 1, como a de forma
    const tipos = Object.fromEntries(deriva.map((rel) => [rel, tipoDaDeriva(rel)]));
    const de = (t) => deriva.filter((rel) => tipos[rel] === t);
    const partes = [de("seguranca").length && `deriva de segurança em: ${de("seguranca").join(", ")}`, de("forma").length && `deriva de forma em: ${de("forma").join(", ")}`].filter(Boolean);
    return { codigo: deriva.length ? 1 : 0, msg: deriva.length ? `${partes.join("; ")} (rode zeno sync)` : "sem deriva", dados: { deriva: [...de("seguranca"), ...de("forma")], tipos }, avisos,
      erros: [...de("seguranca"), ...de("forma")].map((rel) => ({ regra: "deriva", arquivo: rel, tipo: tipos[rel], msg: `gerado diferente do canônico (${tipos[rel] === "seguranca" ? "segurança" : "forma"})` })) };
  }
  const lock = lerLock(raiz);
  for (const f of arquivos) {
    const p = join(raiz, f.rel);
    if (f.bloco || f.lock || !existsSync(p) || lock.has(f.rel)) continue;
    if (readFileSync(p, "utf8") !== f.conteudo) return { codigo: 1, msg: `${f.rel} existe, não é gerado e não está em local: nada foi sobrescrito (mova-o para _lixo/ ou declare-o em local)`, erros: [{ regra: "sync", arquivo: f.rel, msg: "arquivo manual no caminho de um gerado" }] };
  }
  if (deriva.some((rel) => rel === ".claude/settings.json" || rel === ".claude/settings.local.json")) {
    // depois do 1º promover, o zeno do PATH é o shim da cópia fixada: o ln -s do bin/zeno do clone a desligaria (T68)
    const fixada = [join(ctx.home || "", ".local", "share", "zeno", "atual"), ctx.root?.raiz && join(ctx.root.raiz, "atual")].find((p) => p && existsSync(p));
    const como = fixada
      ? `Há cópia fixada (${fixada}): ponha no PATH o shim do promover (~/.local/bin, ou /usr/local/bin no modo root). Não ligue o bin/zeno do clone: o PATH passaria a rodar o código que o agente edita.`
      : "Antes do 1º zeno promover, ligue o shim do clone (ln -s …/zeno/bin/zeno ~/.local/bin/zeno); o promover o troca pela cópia fixada.";
    if (!ctx.which("zeno")) return { codigo: 1, msg: `o zeno não está no PATH: os hooks gerados negariam todo comando. ${como} Depois, rode de novo.`, erros: [{ regra: "sync", msg: `zeno fora do PATH. ${como}` }] };
    const fumaca = ctx.rodar(`printf '%s' '${JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls" }, cwd: raiz, session_id: "fumaca" })}' | zeno guarda pre-tool`, { cwd: raiz });
    if (fumaca.status !== 0 || /deny/.test(fumaca.stdout || "")) return { codigo: 1, msg: `o teste de fumaça do hook falhou (zeno guarda pre-tool saiu ${fumaca.status}): nada foi gerado`, erros: [{ regra: "sync", msg: "fumaça do hook" }] };
  }
  for (const f of arquivos) {
    if (!deriva.includes(f.rel)) continue;
    const p = join(raiz, f.rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.conteudo);
    if (f.modo) chmodSync(p, f.modo);
  }
  // T97: liga só um clone livre (sem core.hooksPath e sem hook ativo), ou o que o Zeno já ligou e ficou sem hooksPath
  const proprio = gh && /*G:githooks-intacto*/ (gh.atual !== "" || (gh.ativos.length > 0 && !gh.ligou));
  if (gh && !proprio) {
    gh.g(["config", "--local", "core.hooksPath", gh.nosso]);
    gh.g(["config", "--local", "zeno.githooks", gh.nosso]);
  }
  for (const rel of orfaos) {
    const lixo = join(raiz, ".agents", "_lixo", `${ctx.agora()}-${rel.replace(/\//g, "__")}`);
    mkdirSync(dirname(lixo), { recursive: true });
    renameSync(join(raiz, rel), lixo);
    try { rmdirSync(dirname(join(raiz, rel))); } catch {} // a pasta do órfão, se ficou vazia
  }
  if (ex && !ex.presente) { mkdirSync(dirname(ex.path), { recursive: true }); appendFileSync(ex.path, `${ex.antes}# zeno (T77): o settings.local.json do Zeno é por máquina\n${ex.linha}\n`); }
  const wt = ex && !ex.presente && ex.worktree ? `\nworktree ligado: a linha ${ex.linha} foi no info/exclude do checkout principal (${ex.path}) e vale para ele e para todos os worktrees; para tirá-la, apague a linha e o comentário "# zeno (T77)" acima dela` : "";
  if (S.trava) ev(S, "sync.executado", null, { check: false, deriva: deriva.length, gerados: arquivos.length });
  const eventos = S.trava ? gravar(S) : [];
  const fim = (deriva.length ? `gerados: ${deriva.join(", ")}` : "nada a gerar") + wt;
  return { codigo: 0, msg: coberto ? `${fim}\n${coberto}` : fim, dados: { gerados: deriva, ...(coberto ? { githooks: coberto } : {}) }, avisos, eventos };
}

export async function sync(ctx, pos, o, reg) {
  const check = lista(o.check).length > 0;
  const S = reg(abrir(ctx, o, { escrever: !check }));
  return sincronizar(S, { check });
}
