// shell.mjs — tokenizador mínimo de shell e as regras da guarda de camada 2 (T67).
// Respeita aspas simples e duplas, escapes, ; && || | &, ( ), $( ), crases, redirecionamentos e here-docs.
// Fail-closed: o que ele não entende (aspas, $( ), here-doc sem fechar; aninhamento fundo) é negado.
// Não é prova: um script escrito antes e rodado depois, ou um caminho em variável, passa (resíduo declarado em seguranca.md).

// arquivos de controle do alvo, os gerados da camada 1–2 e a cópia fixada + shim da pessoa (T68)
const PROT = /ledger\.jsonl|\.fio\.md|gerados\.lock|(^|[\s"'/=])sistema\.yaml|(^|[\s"'/=])faixas\.yaml|\.claude\/settings[^/\s]*\.json|(^|[\s"'/=])CLAUDE\.md|\.local\/share\/zeno|\.local\/bin\/zeno\b/;
// API de escrita em código passado por -e/-c/here-doc (só nega quando o código também cita um caminho protegido)
const ESCREVE = /writeFile|appendFile|createWriteStream|writeSync|openSync\s*\([^)]*,\s*['"`][wax+]|\bopen\s*\([^)]*,\s*(mode\s*=\s*)?['"][^'"]*[wax+]|write_text|write_bytes|\bunlink|\brmSync|\brmdir|\.rm\s*\(|\brename(Sync)?\s*\(|copyFile|cpSync|truncate|os\.remove|shutil\.|symlink/;
export const PESSOA = new Set(["gate", "chave", "guarda", "promover"]); // T92: um teste prende este conjunto ao CATALOGO do ajuda --json
const MAX_PROF = 4;

const ehAtrib = (w) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(w);
const base = (w) => String(w).split("/").pop();

// Índice do ")" que fecha um "(" aberto antes de k (aspas e parênteses aninhados respeitados); -1 se não fecha.
function fechaParen(s, k) {
  let d = 1;
  for (let i = k; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") { i++; continue; }
    if (c === "'") { const j = s.indexOf("'", i + 1); if (j < 0) return -1; i = j; continue; }
    if (c === '"') { let j = i + 1; while (j < s.length && s[j] !== '"') { if (s[j] === "\\") j++; j++; } if (j >= s.length) return -1; i = j; continue; }
    if (c === "(") d++;
    else if (c === ")" && --d === 0) return i;
  }
  return -1;
}

// Código executado de dentro de um texto ($( ) e crases), para here-doc sem aspas no delimitador.
function subsDe(txt, subs) {
  for (let i = 0; i < txt.length; i++) {
    if (txt[i] === "\\") { i++; continue; }
    if (txt[i] === "$" && txt[i + 1] === "(" && txt[i + 2] !== "(") { const f = fechaParen(txt, i + 2); if (f < 0) return false; subs.push(txt.slice(i + 2, f)); i = f; }
    else if (txt[i] === "`") { const f = txt.indexOf("`", i + 1); if (f < 0) return false; subs.push(txt.slice(i + 1, f)); i = f; }
  }
  return true;
}

// Devolve { ok, erro?, comandos: [{ palavras, redirs: [{op, alvo}], heredoc }] }.
export function tokenizar(s, prof = 0) {
  if (prof > MAX_PROF) return { ok: false, erro: "aninhamento fundo demais" };
  s = String(s);
  const cmds = [], subs = [], heredocs = [];
  const novo = () => ({ palavras: [], redirs: [], heredoc: null });
  let cur = novo(), w = null, redir = null, here = null, i = 0;
  const erro = (m) => ({ ok: false, erro: m });
  const palavra = () => (w ||= { t: "" });
  const fimPalavra = () => {
    if (!w) return;
    if (here) { heredocs.push({ cmd: cur, delim: w.t, strip: here.strip, cru: here.cru || w.cita }); here = null; }
    else if (redir) { cur.redirs.push({ op: redir, alvo: w.t }); redir = null; }
    else cur.palavras.push(w.t);
    w = null;
  };
  const fimCmd = () => { fimPalavra(); if (cur.palavras.length || cur.redirs.length || cur.heredoc !== null) cmds.push(cur); cur = novo(); };
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") { if (s[i + 1] === "\n") { i += 2; continue; } palavra().t += s[i + 1] ?? ""; w.cita = true; i += 2; continue; }
    if (/*G:shell-por-parser*/ c === "'") {
      const j = s.indexOf("'", i + 1);
      if (j < 0) return erro("aspas simples sem fechar");
      palavra().t += s.slice(i + 1, j); w.cita = true; i = j + 1; continue;
    }
    if (/*G:shell-por-parser*/ c === '"') {
      let k = i + 1, buf = "";
      while (k < s.length && s[k] !== '"') {
        if (s[k] === "\\" && k + 1 < s.length) { buf += '$`"\\\n'.includes(s[k + 1]) ? s[k + 1] : s[k] + s[k + 1]; k += 2; continue; }
        if (s[k] === "$" && s[k + 1] === "(") { const f = fechaParen(s, k + 2); if (f < 0) return erro("$( sem fechar"); if (s[k + 2] !== "(") subs.push(s.slice(k + 2, f)); buf += s.slice(k, f + 1); k = f + 1; continue; }
        if (s[k] === "`") { const f = s.indexOf("`", k + 1); if (f < 0) return erro("crase sem fechar"); subs.push(s.slice(k + 1, f)); buf += s.slice(k, f + 1); k = f + 1; continue; }
        buf += s[k++];
      }
      if (k >= s.length) return erro("aspas duplas sem fechar");
      palavra().t += buf; w.cita = true; i = k + 1; continue;
    }
    if (c === "$" && s[i + 1] === "(") {
      const f = fechaParen(s, i + 2);
      if (f < 0) return erro("$( sem fechar");
      if (s[i + 2] !== "(") subs.push(s.slice(i + 2, f));
      palavra().t += s.slice(i, f + 1); i = f + 1; continue;
    }
    if (c === "`") { const f = s.indexOf("`", i + 1); if (f < 0) return erro("crase sem fechar"); subs.push(s.slice(i + 1, f)); palavra().t += s.slice(i, f + 1); i = f + 1; continue; }
    if (c === "#" && !w) { while (i < s.length && s[i] !== "\n") i++; continue; }
    if (c === "\n") {
      fimCmd(); i++;
      if (redir || here) return erro("redirecionamento sem alvo");
      for (const h of heredocs.splice(0)) {
        const linhas = [];
        let achou = false;
        while (i < s.length) {
          let f = s.indexOf("\n", i); if (f < 0) f = s.length;
          const l = s.slice(i, f); i = f + 1;
          if ((h.strip ? l.replace(/^\t+/, "") : l) === h.delim) { achou = true; break; }
          linhas.push(l);
        }
        if (!achou) return erro(`here-doc sem fim (${h.delim})`);
        const corpo = linhas.join("\n");
        h.cmd.heredoc = (h.cmd.heredoc ?? "") + corpo;
        if (!h.cru && !subsDe(corpo, subs)) return erro("$( sem fechar no here-doc");
      }
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") { fimPalavra(); i++; continue; }
    if (c === "&" && s[i + 1] === ">") { fimPalavra(); i += 2; if (s[i] === ">") i++; redir = ">"; continue; }
    if (c === ";" || c === "&" || c === "|" || c === "(" || c === ")") {
      // o alvo colado no separador (x >/dev/null; y) fecha antes da checagem: era o falso positivo FP3 da T67
      if (/*G:shell-por-parser*/ true) fimPalavra();
      if (redir || here) return erro("redirecionamento sem alvo");
      fimCmd(); i++;
      if ((c === "&" || c === "|" || c === ";") && (s[i] === c || (c === "|" && s[i] === "&"))) i++;
      continue;
    }
    if (c === ">" || c === "<") {
      if (w && /^\d+$/.test(w.t) && !w.cita) w = null; else fimPalavra();
      i++;
      if (c === "<" && s[i] === "(" || c === ">" && s[i] === "(") { const f = fechaParen(s, i + 1); if (f < 0) return erro("substituição de processo sem fechar"); subs.push(s.slice(i + 1, f)); i = f + 1; continue; }
      if (c === "<" && s[i] === "<") {
        i++;
        if (s[i] === "<") { i++; redir = "<<<"; continue; }
        let strip = false; if (s[i] === "-") { strip = true; i++; }
        here = { strip }; continue;
      }
      let op = c;
      if (c === ">" && (s[i] === ">" || s[i] === "|")) { if (s[i] === ">") op = ">>"; i++; }
      else if (c === "<" && s[i] === ">") { op = "<>"; i++; }
      if (s[i] === "&") { i++; if (/[\d-]/.test(s[i] ?? "")) { while (/[\d-]/.test(s[i] ?? "")) i++; continue; } }
      redir = op; continue;
    }
    palavra().t += c; i++;
  }
  fimCmd();
  if (redir || here) return erro("redirecionamento sem alvo");
  if (heredocs.length) return erro(`here-doc sem fim (${heredocs[0].delim})`);
  for (const sub of subs) {
    const r = tokenizar(sub, prof + 1);
    if (!r.ok) return r;
    cmds.push(...r.comandos);
  }
  return { ok: true, comandos: cmds };
}

// Tira atribuições e comandos-prefixo (env, sudo, timeout, xargs, nice, nohup, time, exec, palavras-chave).
function nucleo(p) {
  const atribs = [];
  let k = 0;
  const pulaFlags = (comValor) => { while (k < p.length && p[k].startsWith("-") && p[k] !== "-") { if (comValor.includes(p[k])) k++; k++; } };
  while (k < p.length) {
    const x = p[k];
    if (ehAtrib(x)) { atribs.push(x); k++; continue; }
    if (["!", "{", "}", "then", "do", "else", "elif", "if", "while", "until", "time", "nohup", "command", "exec", "builtin", "stdbuf"].includes(x)) { k++; continue; }
    if (x === "sudo" || x === "doas") { k++; pulaFlags(["-u", "-g", "-C", "-D", "-h", "-p", "-U"]); continue; }
    if (x === "env") {
      k++;
      while (k < p.length) {
        if (p[k] === "-u" || p[k] === "--unset") { atribs.push(`-u:${p[k + 1]}`); k += 2; continue; }
        if (/^-u./.test(p[k])) { atribs.push(`-u:${p[k].slice(2)}`); k++; continue; }
        if (p[k].startsWith("--unset=")) { atribs.push(`-u:${p[k].slice(8)}`); k++; continue; }
        if (ehAtrib(p[k])) { atribs.push(p[k]); k++; continue; }
        if (p[k].startsWith("-")) { if (["-C", "-S", "--chdir", "--split-string"].includes(p[k])) k++; k++; continue; }
        break;
      }
      continue;
    }
    if (x === "timeout") { k++; pulaFlags(["-s", "-k", "--signal", "--kill-after"]); k++; continue; }
    if (x === "nice") { k++; if (p[k] === "-n") k += 2; else if (/^-\d+$/.test(p[k] ?? "")) k++; continue; }
    if (x === "xargs") { k++; pulaFlags(["-I", "-n", "-P", "-L", "-d", "-s", "-E", "-a", "--arg-file", "--delimiter", "--max-args", "--max-procs"]); continue; }
    break;
  }
  return { atribs, argv: p.slice(k) };
}

// sed/perl: em lugar (-i)? quais args são script e quais são arquivos operandos (T71). Na dúvida, o arg conta como arquivo.
function emLugar(n, a) {
  // opções em qualquer posição (o getopt do GNU permuta: `sed 's/a/b/' -i f` vale); depois de `--`, tudo é operando
  const scripts = [], pos = [];
  let inplace = false, temScript = false, fim = false;
  const comValor = n === "sed" ? { e: "s", f: "f", l: "x" } : { e: "s", E: "s", I: "x", M: "x", m: "x", x: "x", C: "x" };
  for (let k = 0; k < a.length; k++) {
    const x = a[k];
    if (fim || !x.startsWith("-") || x === "-") { pos.push(x); continue; }
    if (x === "--") { fim = true; continue; }
    if (x.startsWith("--")) {
      if (x.startsWith("--in-place")) inplace = true;
      else if (n === "sed" && (x === "--expression" || x === "--file")) { if (x === "--expression") scripts.push(a[k + 1] ?? ""); temScript = true; k++; }
      else if (n === "sed" && (x.startsWith("--expression=") || x.startsWith("--file="))) { if (x.startsWith("--expression=")) scripts.push(x.slice(13)); temScript = true; }
      continue;
    }
    for (let j = 1; j < x.length; j++) {
      const c = x[j];
      if (c === "i") { inplace = true; break; }          // o resto do grupo é o sufixo do backup
      if (n === "perl" && c === "0") break;               // -0777: dígitos colados
      const v = comValor[c];
      if (!v) continue;
      const val = j + 1 < x.length ? x.slice(j + 1) : a[++k] ?? "";
      if (v === "s") { scripts.push(val); temScript = true; } else if (v === "f") temScript = true;
      break;
    }
  }
  if (!temScript && pos.length) scripts.push(pos.shift());   // sem -e/-f: o 1º operando é o script (perl: o programa)
  return { inplace, scripts, arquivos: pos };
}

// Código que um comando executa: sh/bash -c, eval, find -exec, node/python/perl -e/-c, ou here-doc para um intérprete.
function codigoDe(argv, heredoc) {
  const n = base(argv[0] || ""), a = argv.slice(1);
  if (["sh", "bash", "zsh", "dash", "ksh"].includes(n)) {
    const k = a.findIndex((x) => /^-[a-z]*c[a-z]*$/.test(x));
    if (k >= 0) return { shell: a[k + 1] ?? "" };
    if (!a.some((x) => !x.startsWith("-")) && heredoc !== null) return { shell: heredoc };
    return null;
  }
  if (n === "eval") return { shell: a.join(" ") };
  const opt = { node: ["-e", "--eval", "-p", "--print"], nodejs: ["-e", "--eval", "-p", "--print"], bun: ["-e", "--eval"], deno: ["eval"],
    python: ["-c"], python3: ["-c"], perl: ["-e", "-E"], ruby: ["-e"] }[n];
  if (!opt) return null;
  const k = a.findIndex((x) => opt.includes(x));
  if (k >= 0) return { codigo: a[k + 1] ?? "" };
  if (heredoc !== null && (!a.length || a.every((x) => x === "-" || x.startsWith("-")))) return { codigo: heredoc };
  return null;
}

// Devolve a regra que nega um comando simples, ou null. prof: aninhamento (sh -c, eval, find -exec).
function regraDe(cmd, prof) {
  const { atribs, argv } = nucleo(cmd.palavras);
  // ator: mexer em ZENO_ATOR, CLAUDECODE ou CLAUDE_CODE_SESSION_ID (a sessão cujo gasto a CLI mede)
  if (atribs.some((x) => /^(-u:)?(ZENO_ATOR|CLAUDECODE|CLAUDE_CODE_SESSION_ID)(=|$)/.test(x))) return "ator";
  const n = base(argv[0] || ""), a = argv.slice(1);
  if (["export", "declare", "typeset", "readonly", "local", "unset"].includes(n) && a.some((x) => /^(ZENO_ATOR|CLAUDECODE|CLAUDE_CODE_SESSION_ID)(=|$)/.test(x))) return "ator";
  // escrita protegida por redirecionamento (qualquer comando)
  if (cmd.redirs.some((r) => [">", ">>", "<>"].includes(r.op) && PROT.test(r.alvo))) return "arquivo-protegido";
  if (!argv.length) return null;
  // pessoa: zeno (ou node …/cli.mjs) em posição de comando, com o verbo no argumento 1
  let resto = null;
  if (n === "zeno") resto = a;
  else if (["node", "nodejs"].includes(n)) { const k = a.findIndex((x) => !x.startsWith("-")); if (k >= 0 && /(^|\/)cli\.mjs$/.test(a[k])) resto = a.slice(k + 1); }
  if (resto && (PESSOA.has(resto[0]) || (resto[0] === "caixa" && resto.includes("--aprovar")))) return "pessoa";
  // histórico
  if (n === "git") {
    let k = 0;
    while (k < a.length && a[k].startsWith("-")) { if (["-c", "-C", "--git-dir", "--work-tree", "--namespace"].includes(a[k])) k++; k++; }
    const sub = a[k], r = a.slice(k + 1);
    const curtas = r.filter((x) => /^-[a-zA-Z]+$/.test(x)).join("");
    if (["commit", "push", "merge", "rebase", "am", "cherry-pick"].includes(sub) && r.includes("--no-verify")) return "historico";
    if (sub === "commit" && (r.includes("--amend") || curtas.includes("n"))) return "historico";
    if (["rebase", "filter-branch", "filter-repo"].includes(sub)) return "historico";
    if (sub === "reset" && r.some((x) => ["--soft", "--hard", "--mixed"].includes(x) || /^HEAD[~^]/.test(x))) return "historico";
    if (["checkout", "restore", "rm", "mv"].includes(sub) && r.some((x) => PROT.test(x))) return "arquivo-protegido";
  }
  // escrita protegida por comando
  const arqs = a.filter((x) => !x.startsWith("-"));
  if (n === "tee" && arqs.some((x) => PROT.test(x))) return "arquivo-protegido";
  if (["sed", "perl"].includes(n)) {
    // T71 (FP4): só os arquivos operandos contam, não o texto do script; no sed, `w <arquivo>` do script também escreve
    const ip = emLugar(n, a), alvos = /*G:shell-por-parser*/ true ? ip.arquivos : arqs;   // mutado: volta a olhar o script (o FP4)
    if (ip.inplace && alvos.some((x) => PROT.test(x))) return "arquivo-protegido";
    if (n === "sed" && ip.scripts.some((s) => [...s.matchAll(/(?:^|[^a-zA-Z])[wW]\s+([^\s;}]+)/g)].some((m) => PROT.test(m[1])))) return "arquivo-protegido";
  }
  if (["mv", "rm", "truncate", "shred", "unlink"].includes(n) && arqs.some((x) => PROT.test(x))) return "arquivo-protegido";
  if (["cp", "install", "ln", "rsync", "scp"].includes(n) && arqs.length && PROT.test(arqs.at(-1))) return "arquivo-protegido";
  if (n === "dd" && a.some((x) => x.startsWith("of=") && PROT.test(x))) return "arquivo-protegido";
  // find -exec: o que vem depois é um comando
  if (n === "find") {
    const k = a.findIndex((x) => ["-exec", "-execdir", "-ok", "-okdir"].includes(x));
    if (k >= 0) {
      let f = a.findIndex((x, j) => j > k && (x === ";" || x === "+")); if (f < 0) f = a.length;
      const inner = a.slice(k + 1, f), r = regraDe({ palavras: inner, redirs: [], heredoc: null }, prof + 1);
      if (r) return r;
      // o {} é o arquivo achado: se o find procura um protegido e o -exec muda arquivo, nega
      const ni = base(nucleo(inner).argv[0] || "");
      const muda = ["rm", "mv", "cp", "truncate", "shred", "unlink", "tee", "dd"].includes(ni) || (["sed", "perl"].includes(ni) && inner.some((x) => /^-[a-zA-Z]*i/.test(x)));
      if (muda && a.slice(0, k).some((x) => PROT.test(x))) return "arquivo-protegido";
    }
    if (a.includes("-delete") && a.some((x) => PROT.test(x))) return "arquivo-protegido";
  }
  // código executado
  const cod = codigoDe(argv, cmd.heredoc);
  if (cod?.shell !== undefined) return negarShell(cod.shell, prof + 1);
  if (cod?.codigo !== undefined) {
    const soLe = /*G:shell-por-parser*/ !ESCREVE.test(cod.codigo);
    if (PROT.test(cod.codigo) && !soLe) return "arquivo-protegido";
  }
  return null;
}

// Ids de nó citados em comandos zeno da linha (zeno <verbo> <id>, registrar gasto <id>), para atribuir uma recusa (T70).
const COM_ID = new Set(["avancar", "gate", "ajustar", "msg", "contexto", "status"]);
export function idsCitados(cmd) {
  const t = tokenizar(cmd), ids = [];
  if (!t.ok) return ids;
  for (const c of t.comandos) {
    const { argv } = nucleo(c.palavras), n = base(argv[0] || ""), a = argv.slice(1);
    let resto = null;
    if (n === "zeno") resto = a;
    else if (["node", "nodejs"].includes(n)) { const k = a.findIndex((x) => !x.startsWith("-")); if (k >= 0 && /(^|\/)cli\.mjs$/.test(a[k])) resto = a.slice(k + 1); }
    if (!resto) continue;
    if (COM_ID.has(resto[0]) && resto[1] && !resto[1].startsWith("-")) ids.push(resto[1]);
    if (resto[0] === "registrar" && resto[1] === "gasto" && resto[2]) ids.push(resto[2]);
  }
  return ids;
}

// A regra que nega a linha de comando inteira, ou null.
export function negarShell(cmd, prof = 0) {
  const t = tokenizar(cmd, prof);
  if (/*G:shell-ilegivel*/ !t.ok) return "shell-ilegivel";
  for (const c of t.comandos) { const r = regraDe(c, prof); if (r) return r; }
  return null;
}
