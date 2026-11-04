// prova.mjs — a prova do promover isolada (nó a-prova-do-promover-roda-isolada, T90). Os testes e o censo são código
// do agente; o promover os roda TODOS num bwrap sem rede, sem a casa do Filipe e com o repositório só leitura. Nada roda
// fora: a sonda sessao-fronteira cria o próprio bwrap lá dentro, porque este sandbox não leva --disable-userns (o do
// zeno sessao leva). Não há lista do que roda fora, então não há dado que o agente edite para mandar código para fora.
// Este arquivo só monta o plano; quem roda é o promover, pelo ctx.rodar.
import { existsSync, lstatSync, readlinkSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute } from "node:path";

export const aspas = (x) => (/^[\w./:=@,+-]+$/.test(String(x)) ? String(x) : `'${String(x).replace(/'/g, `'\\''`)}'`);
const dentro = (p, base) => { const r = relative(base, p); return r === "" || (!r.startsWith("..") && !isAbsolute(r)); };

// O argv do bwrap da prova: namespaces próprios e sem rede; o sistema e o repositório só leitura; /tmp, /run e a casa em
// tmpfs (a casa de verdade e a chave não existem lá dentro). Sem --disable-userns: as sondas que criam bwrap aninham.
export function planoProva({ ctx, src, node }) {
  const home = ctx.home, env = ctx.env || {}, a = [];
  const ro = (p) => a.push("--ro-bind", p, p);
  a.push("--unshare-user", "--unshare-pid", "--unshare-ipc", "--unshare-uts", "--unshare-cgroup-try", "--unshare-net");
  a.push("--new-session", "--die-with-parent", "--cap-drop", "ALL", "--hostname", "zeno-prova", "--clearenv");
  ro("/usr"); ro("/etc");
  for (const d of ["/bin", "/lib", "/lib64", "/lib32", "/sbin"]) {
    if (!existsSync(d)) continue;
    if (lstatSync(d).isSymbolicLink()) a.push("--symlink", readlinkSync(d), d); else ro(d);
  }
  a.push("--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp", "--tmpfs", "/run", "--tmpfs", home);
  if (isAbsolute(node) && !node.startsWith("/usr/")) ro(dirname(dirname(node)));
  // o repositório inteiro só leitura (a suíte lê ../ e spec/); num worktree, o git comum também
  const g = (args) => ctx.git(args, { cwd: src });
  const t = g(["rev-parse", "--show-toplevel"]).stdout?.trim();
  const topo = t && isAbsolute(t) && existsSync(t) && dentro(src, t) ? t : src;
  ro(topo);
  const c = g(["rev-parse", "--git-common-dir"]).stdout?.trim();
  const comum = c ? resolve(src, c) : null;
  if (comum && isAbsolute(comum) && existsSync(comum) && !dentro(comum, topo)) ro(comum);
  a.push("--seccomp", "3");
  const E = { PATH: [...(isAbsolute(node) ? [dirname(node)] : []), "/usr/bin", "/bin"].join(":"), HOME: home };
  for (const k of ["LANG", "LC_ALL", "TZ"]) if (env[k] !== undefined) E[k] = env[k];
  for (const [k, v] of Object.entries(E)) a.push("--setenv", k, String(v));
  a.push("--chdir", src);
  return a;
}

// A linha de shell da prova isolada: o fd 3 é o filtro seccomp (o mesmo do zeno sessao).
export const comandoIsolado = (args, node, cmd, filtro) => `${["bwrap", ...args, "--", node, ...cmd].map(aspas).join(" ")} 3< ${aspas(filtro)}`;
