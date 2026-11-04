// lancar.mjs — zeno sessao <agente> [--plano] [-- comando …] (T82, camada A da D39).
// Abre a CLI de um agente (claude, a CLI de outro fornecedor, hermes…) num bwrap por sessão, com o perfil do registro
// agentes: do sistema.yaml. O SO impõe a fronteira; o Zeno declara, monta, registra no ledger e prova com sondas.
// O que pede root (lançador, cópia fixada e managed-settings com dono root) não é daqui: é do roteiro do Filipe.
import { existsSync, lstatSync, readlinkSync, realpathSync, mkdirSync, writeFileSync, readdirSync, mkdtempSync, rmSync, chmodSync } from "node:fs";
import { join, resolve, dirname, relative, isAbsolute } from "node:path";
import { abrir, ev, gravar, fechar } from "../sessao.mjs";
import { ZENO_DIR } from "../config.mjs";
import { bpf } from "../seccomp.mjs";
import { servirProxy } from "../proxy.mjs";
import { lista, Recusa, ehAgente } from "../util.mjs";

export const PORTA_RELAY = 3128;
const ENV_BASE = ["LANG", "LC_ALL", "LC_CTYPE", "TERM", "COLORTERM", "TZ"];
// nunca entram, mesmo se o perfil pedir: o interop do Windows, a tela, o barramento, o canal entre sessões, o agente ssh
const ENV_PROIBIDA = /^(WSL_INTEROP|WSLENV|WSL_DISTRO_NAME|DISPLAY|WAYLAND_DISPLAY|DBUS_SESSION_BUS_ADDRESS|XDG_RUNTIME_DIR|SSH_AUTH_SOCK|GPG_AGENT_INFO|CLAUDE_CODE_MESSAGING_\w+|ZENO_ATOR|CLAUDECODE|LD_PRELOAD|LD_LIBRARY_PATH|NODE_OPTIONS)$/;
// arquivos de controle que rodam FORA do sandbox (git, hooks, o harness de outro claude, o editor): só leitura dentro
const SO_LEITURA = [".githooks", ".claude", ".mcp.json", ".zed", ".vscode", ".envrc", ".idea"];

const expandir = (p, home) => (String(p) === "~" ? home : String(p).startsWith("~/") ? join(home, String(p).slice(2)) : resolve(String(p)));
const dentro = (p, base) => { const r = relative(base, p); return r === "" || (!r.startsWith("..") && !isAbsolute(r)); };
function acharNoPath(bin, PATH) {
  if (String(bin).includes("/")) return existsSync(bin) ? resolve(bin) : null;
  for (const d of String(PATH || "").split(":")) if (d && existsSync(join(d, bin))) return join(d, bin);
  return null;
}
// o que um perfil nunca expõe (defesa a mais: o sistema.yaml é do Filipe, mas um erro de digitação não abre a chave)
export function proibido(p, home) {
  const fora = ["/init", "/run/WSL", "/mnt", "/usr/lib/wsl", "/dev", "/proc", "/run/user", join(home, ".config"), join(home, ".ssh"), join(home, ".gnupg"), join(home, ".docker"), join(home, ".aws"), join(home, ".claude"), join(home, ".claude.json"), join(home, ".local/share/zeno")];
  return p === home || p === "/" || fora.some((f) => dentro(p, f) || dentro(f, p) && p !== "/home");
}

// O plano do bwrap, sem efeito colateral: o argv, o env do filho, os arquivos a gravar na pasta da sessão e o filtro.
export function planoSessao({ ctx, cfg, raiz, id, comando = [], sessaoDir }) {
  const perfil = cfg.perfis?.[id];
  if (!ehAgente(id) || !perfil) throw new Recusa(1, "agente", `${id} não tem perfil no registro agentes: do sistema.yaml`);
  const home = ctx.home, env = ctx.env || {};
  const cmd = comando.length ? comando : lista(perfil.comando).map(String);
  if (!cmd.length) throw new Recusa(1, "agente", `o perfil de ${id} não tem comando`);
  const bin = acharNoPath(cmd[0], env.PATH);
  if (!bin) throw new Recusa(1, "agente", `comando não achado no PATH: ${cmd[0]}`);
  const node = acharNoPath("node", env.PATH);
  if (!node) throw new Recusa(1, "agente", "node não achado no PATH (o zeno e o relay rodam nele)");
  const a = [], binds = [];
  const ro = (p, dst = p) => { a.push("--ro-bind", p, dst); binds.push(["ro", p, dst]); };
  const rw = (p) => { a.push("--bind", p, p); binds.push(["rw", p, p]); };

  // processo: namespaces próprios, sem criar outro userns, sem terminal de controle, morre com o lançador
  a.push("--unshare-user", "--disable-userns", "--unshare-pid", "--unshare-ipc", "--unshare-uts", "--unshare-cgroup-try");
  if (/*G:sessao-rede*/ true) a.push("--unshare-net"); // sem exceção por perfil: a saída é só pelo proxy
  a.push("--new-session", "--die-with-parent", "--cap-drop", "ALL", "--hostname", "zeno-sessao", "--clearenv");
  // o sistema só leitura; /proc, /dev (devpts próprio, sem /dev/dxg), /tmp e /run novos; a casa do Filipe some
  ro("/usr"); ro("/etc");
  for (const d of ["/bin", "/lib", "/lib64", "/lib32", "/sbin"]) {
    if (!existsSync(d)) continue;
    if (lstatSync(d).isSymbolicLink()) a.push("--symlink", readlinkSync(d), d); else ro(d);
  }
  a.push("--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp", "--tmpfs", "/run", "--tmpfs", home);

  // o que roda: o binário real do agente, o node, e a cópia fixada do zeno (ou este código, num alvo sem cópia)
  const binReal = realpathSync(bin), nodeReal = realpathSync(node);
  const nodeRaiz = dirname(dirname(nodeReal));
  if (!nodeReal.startsWith("/usr/")) ro(nodeRaiz);
  if (!dentro(binReal, nodeRaiz) && !binReal.startsWith("/usr/")) ro(binReal);
  // a cópia com dono root (roteiro da T82, passo 2) vale antes da do usuário; sem nenhuma, este código
  const atual = ["/opt/zeno/atual", join(home, ".local/share/zeno/atual")].find((p) => existsSync(join(p, "cli.mjs")));
  const zenoDir = atual ? realpathSync(atual) : ZENO_DIR;
  ro(zenoDir);

  // o repositório: leitura e escrita, com o controle do git e o harness só leitura por cima
  const g = (args) => ctx.git(args, { cwd: raiz });
  const topo = g(["rev-parse", "--show-toplevel"]).stdout?.trim() || raiz;
  const comumRel = g(["rev-parse", "--git-common-dir"]).stdout?.trim();
  const comum = comumRel ? resolve(raiz, comumRel) : null;
  rw(topo);
  if (comum && existsSync(comum) && !dentro(comum, topo)) rw(comum);
  const prot = new Set();
  const subs = (d) => { try { return readdirSync(d, { withFileTypes: true }).filter((x) => x.isDirectory() && !x.name.startsWith(".")).map((x) => join(d, x.name)); } catch { return []; } };
  for (const d of new Set([topo, raiz, ...subs(topo)])) for (const n of SO_LEITURA) if (existsSync(join(d, n))) prot.add(join(d, n));
  if (comum) for (const n of ["config", "hooks", "info", "config.worktree"]) if (existsSync(join(comum, n))) prot.add(join(comum, n));
  if (/*G:sessao-repo-so-leitura*/ true) for (const p of [...prot].sort()) ro(p);

  // o que o perfil declara: leitura, credenciais (só leitura) e escrita; nada do que é proibido
  const extra = (p) => { const x = expandir(p, home); if (/*G:sessao-proibidos*/ proibido(x, home)) throw new Recusa(1, "agente", `o perfil de ${id} pede ${p}, que a sessão nunca expõe`); return x; };
  for (const p of [...lista(perfil.le), ...lista(perfil.credenciais)]) { const x = extra(p); if (existsSync(x)) ro(x); }
  for (const p of lista(perfil.escreve)) { const x = extra(p); if (existsSync(x)) rw(x); }
  // a configuração própria do agente (login próprio; os conectores do claude.ai se desligam nela)
  const nome = id.replace(/^ia:/, "");
  const cfgDir = perfil.config_dir ? extra(perfil.config_dir) : join(home, ".local/share/zeno-agentes", nome, "config");
  const cfgEnv = perfil.config_env ?? (cmd[0].split("/").pop() === "claude" ? "CLAUDE_CONFIG_DIR" : null);
  rw(cfgDir);

  // a pasta da sessão: o marcador (identidade), o shim do zeno e o socket do proxy
  ro(join(sessaoDir, "agente"), "/run/zeno-agente");
  ro(join(sessaoDir, "bin"), "/run/zeno-bin");
  a.push("--bind", join(sessaoDir, "proxy.sock"), "/run/zeno-proxy.sock");
  if (/*G:sessao-seccomp*/ true) a.push("--seccomp", "3");

  // o ambiente: só a allowlist
  const px = `http://127.0.0.1:${PORTA_RELAY}`;
  const E = { PATH: ["/run/zeno-bin", dirname(nodeReal), "/usr/local/bin", "/usr/bin", "/bin"].join(":"), HOME: home, HTTPS_PROXY: px, HTTP_PROXY: px, https_proxy: px, http_proxy: px, NO_PROXY: "localhost,127.0.0.1", no_proxy: "localhost,127.0.0.1" };
  if (cfgEnv) E[cfgEnv] = cfgDir;
  for (const k of [...ENV_BASE, ...lista(perfil.env).map(String)]) if (env[k] !== undefined && /*G:sessao-env*/ !ENV_PROIBIDA.test(k)) E[k] = env[k];
  for (const [k, v] of Object.entries(E)) a.push("--setenv", k, String(v));
  const cwd = dentro(ctx.cwd, topo) ? ctx.cwd : raiz;
  a.push("--chdir", cwd);

  const shim = `#!/bin/sh\nexec "${nodeReal}" "${join(zenoDir, "cli.mjs")}" "$@"\n`;
  const inner = [nodeReal, join(zenoDir, "cli.mjs"), "relay", String(PORTA_RELAY), "/run/zeno-proxy.sock", "--", binReal, ...cmd.slice(1)];
  return {
    bin: "bwrap", args: [...a, "--", ...inner], binds, cfgDir, zenoDir, comando: cmd,
    hosts: lista(perfil.hosts).map(String), portas: lista(perfil.portas ?? [443, 80]).map(Number),
    arquivos: { agente: `${id}\n`, "bin/zeno": shim },
  };
}

// zeno sessao <agente> [--plano] [-- comando …]: grava sessao.aberta, sobe o proxy, roda o bwrap, grava sessao.fechada.
export async function sessao(ctx, pos, o, reg) {
  const id = pos[0];
  if (!id) throw new Recusa(2, "uso", "zeno sessao <agente> [--plano] [-- comando …]");
  if (ctx.marcador) throw new Recusa(1, "sessao", "já dentro de uma sessão de agente: sessão não se aninha");
  if (!ctx.executar) throw new Recusa(6, "sessao", "esta CLI não sabe lançar processo");
  const comando = Array.isArray(o["--"]) ? o["--"] : [];
  const S1 = abrir(ctx, o, { escrever: !o.plano });
  const dir = o.plano ? "/run/zeno-sessao-plano" : mkdtempSync(join(ctx.tmp || "/tmp", "zeno-sessao-"));
  // o sun_path do socket cabe em 108 bytes (com o \0): com uma pasta temporária funda, recusa antes do EINVAL do listen
  if (!o.plano && Buffer.byteLength(join(dir, "proxy.sock")) > 107) {
    fechar(S1); rmSync(dir, { recursive: true, force: true });
    throw new Recusa(1, "sessao", `o caminho do socket do proxy passa de 108 bytes (${join(dir, "proxy.sock")}): use uma pasta temporária mais curta`);
  }
  let p;
  try { p = planoSessao({ ctx, cfg: S1.cfg, raiz: S1.raiz, id, comando, sessaoDir: dir }); }
  catch (e) { fechar(S1); if (!o.plano) rmSync(dir, { recursive: true, force: true }); throw e; }
  if (o.plano) { fechar(S1); return { codigo: 0, msg: [p.bin, ...p.args].map((x) => (/^[\w./:=@,+-]+$/.test(x) ? x : JSON.stringify(x))).join(" "), dados: { bin: p.bin, args: p.args, binds: p.binds, hosts: p.hosts } }; }
  const t0 = ctx.agora();
  let px = null;
  try {
    // T105: o marcador leva, depois do agente, o id do sessao.aberta; o ato de dentro o grava em sessao (declaração)
    const aberta = ev(S1, "sessao.aberta", null, { agente: id, comando: p.comando[0], hosts: p.hosts, binds: p.binds.length });
    const arquivos = { ...p.arquivos, agente: `${id} ${aberta.id}\n` };
    mkdirSync(join(dir, "bin"), { recursive: true }); mkdirSync(p.cfgDir, { recursive: true, mode: 0o700 });
    for (const [rel, txt] of Object.entries(arquivos)) writeFileSync(join(dir, rel), txt);
    chmodSync(join(dir, "bin/zeno"), 0o755);
    writeFileSync(join(dir, "seccomp.bpf"), bpf(ctx.arch === "arm64" ? "arm64" : "x64"));
    px = await servirProxy(join(dir, "proxy.sock"), { hosts: p.hosts, portas: p.portas });
    gravar(S1); fechar(S1);
    const r = await ctx.executar(p.bin, p.args, { env: { PATH: (ctx.env || {}).PATH || "/usr/bin:/bin" }, fd3: join(dir, "seccomp.bpf") });
    const S2 = reg(abrir(ctx, o));
    const rede = { permitidas: px.conta.permitidas, negadas: px.conta.negadas, negados: [...px.conta.negados].slice(0, 20) };
    ev(S2, "sessao.fechada", null, { agente: id, codigo: r.status, dur_ms: ctx.agora() - t0, rede });
    return { codigo: r.status === 0 ? 0 : 1, msg: `sessão de ${id} fechada (saída ${r.status}${r.erro ? `: ${r.erro}` : ""}; rede: ${rede.permitidas} permitidas, ${rede.negadas} negadas)`, dados: { saida: r.status, rede }, eventos: gravar(S2) };
  } finally {
    fechar(S1);
    if (px) await px.fechar();
    rmSync(dir, { recursive: true, force: true }); // só a pasta desta sessão, criada acima
  }
}
