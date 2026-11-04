// shell.test.mjs — o tokenizador e as regras da guarda de camada 2 (T67).
import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenizar, negarShell } from "../core/shell.mjs";
import { FP1, FP2, FP3, FP4, FP_ACEITO } from "./fp-shell.mjs";

test("tokenizar: aspas, escapes, separadores, redirecionamentos, $( ) e here-doc", () => {
  const t = tokenizar(`echo "a; b" 'c || d' e\\ f; ls -l | wc -l && x=$(date) || y 2>&1 >> out.txt`);
  assert.equal(t.ok, true);
  assert.deepEqual(t.comandos[0].palavras, ["echo", "a; b", "c || d", "e f"]);
  assert.deepEqual(t.comandos.map((c) => c.palavras[0]), ["echo", "ls", "wc", "x=$(date)", "y", "date"]);
  assert.deepEqual(t.comandos[4].redirs, [{ op: ">>", alvo: "out.txt" }]);
  const h = tokenizar("cat > nota.md <<'EOF'\nlinha com zeno gate x > .agents/ledger.jsonl\nEOF\nls");
  assert.equal(h.ok, true);
  assert.equal(h.comandos[0].heredoc, "linha com zeno gate x > .agents/ledger.jsonl");
  assert.deepEqual(h.comandos.map((c) => c.palavras[0]), ["cat", "ls"]);
  for (const ruim of [`echo 'oi`, `echo "oi`, `echo $(date`, "cat <<EOF\nsem fim", "echo `x", "ls >"]) assert.equal(tokenizar(ruim).ok, false, ruim);
});

test("os falsos positivos da guarda (FP1, FP2 do 1º dia; FP3 da Observação da T67) passam", () => {
  assert.equal(negarShell(FP3), null);
  assert.equal(negarShell(FP4), null);
  assert.equal(negarShell(FP1), null);
  assert.equal(negarShell(FP2), null);
});

test("leitura passa; texto citado em argumento passa", () => {
  for (const c of ["cat .agents/ledger.jsonl", "grep -c ev .agents/ledger.jsonl 2>/dev/null", "node -e 'console.log(require(\"fs\").readFileSync(\".agents/ledger.jsonl\",\"utf8\").length)'",
    "python3 -c 'print(open(\".agents/sistema.yaml\").read())'", "echo 'zeno gate x --aprovar' | wc -c", "git log -- .agents/ledger.jsonl", "zeno caixa", "zeno avancar x --ate fim",
    "git commit -m 'feat: x' -- zeno/.agents", "cat > nota.md <<'EOF'\nzeno gate x --aprovar > .agents/ledger.jsonl\nEOF", "diff .agents/sistema.yaml /tmp/x", "ls -la .agents/ 2>&1 | head"])
    assert.equal(negarShell(c), null, c);
});

test("o que tem de negar continua negado", () => {
  const casos = {
    "zeno gate x --aprovar": "pessoa", "zeno caixa --aprovar": "pessoa", "node cli.mjs chave nova": "pessoa", "node ./cli.mjs guarda fim-sessao": "pessoa",
    "true || zeno caixa --aprovar": "pessoa", "cd zeno && zeno gate x --reprovar --motivo y": "pessoa", "sh -c \"zeno caixa --aprovar\"": "pessoa",
    "bash -c 'cd x; zeno gate n --aprovar'": "pessoa", "echo $(zeno chave nova)": "pessoa", "timeout 5 zeno gate x --aprovar": "pessoa", "env FOO=1 zeno gate x": "pessoa",
    "echo x > .agents/ledger.jsonl": "arquivo-protegido", "echo x >.agents/ledger.jsonl; ls": "arquivo-protegido", "ls >.agents/gerados.lock|cat": "arquivo-protegido",
    "(echo x >>.agents/trabalho/a.fio.md)": "arquivo-protegido", "true >.agents/sistema.yaml&& ls": "arquivo-protegido",
    "cat <<EOF;\nx\nEOF": null,"echo x >> .agents/trabalho/a.fio.md": "arquivo-protegido", "printf x | tee -a .agents/ledger.jsonl": "arquivo-protegido",
    "sed -i s/a/b/ .agents/sistema.yaml": "arquivo-protegido", "sed s/a/b/ -i .agents/sistema.yaml": "arquivo-protegido",
    "sed -i -e s/a/b/ .agents/ledger.jsonl": "arquivo-protegido", "sed -i.bak 's/a/b/' x.md .agents/faixas.yaml": "arquivo-protegido",
    "sed -ni -e p -- .agents/gerados.lock": "arquivo-protegido", "sed --in-place=.b --expression=s/a/b/ .agents/ledger.jsonl": "arquivo-protegido",
    "sed -n 's/a/b/w .agents/ledger.jsonl' x.md": "arquivo-protegido", "sed -i '1w .agents/trabalho/a.fio.md' x.md": "arquivo-protegido",
    "perl -pi -e s/a/b/ .agents/sistema.yaml": "arquivo-protegido", "perl -i.bak -pe 's/a/b/' x .agents/ledger.jsonl": "arquivo-protegido",
    "sed -i 's|x|.agents/ledger.jsonl|' test/a.mjs": null, "sed -i -e 's/ledger.jsonl/x/' -e 's/y/z/' a.md b.md": null,
    "perl -pi -e 's/.agents\\/ledger.jsonl/x/' a.md": null, "sed -i 's/show .agents.ledger.jsonl/x/' a.md": null,"cp /tmp/x .agents/faixas.yaml": "arquivo-protegido", "mv .agents/ledger.jsonl /tmp/": "arquivo-protegido",
    "rm .agents/gerados.lock": "arquivo-protegido", "truncate -s0 .agents/ledger.jsonl": "arquivo-protegido",
    "node -e \"require('fs').writeFileSync('.agents/faixas.yaml','')\"": "arquivo-protegido",
    "node -e 'require(\"fs\").appendFileSync(\".agents/ledger.jsonl\",\"x\")'": "arquivo-protegido",
    "python3 -c \"open('.agents/ledger.jsonl','a').write('x')\"": "arquivo-protegido",
    "python3 - <<'EOF'\nopen('.agents/sistema.yaml','w').write('x')\nEOF": "arquivo-protegido",
    "git checkout -- .agents/ledger.jsonl": "arquivo-protegido", "find . -name ledger.jsonl -exec rm {} \\;": "arquivo-protegido",
    "ZENO_ATOR=ana zeno avancar x": "ator", "export ZENO_ATOR=ana": "ator", "env -u CLAUDECODE zeno status": "ator", "unset CLAUDECODE": "ator",
    "git commit --no-verify -m x": "historico", "git commit -nm x": "historico", "git commit --amend": "historico", "git reset --hard HEAD~1": "historico", "git rebase main": "historico",
    "echo 'oi": "shell-ilegivel", "zeno status \"x": "shell-ilegivel", "cat <<EOF\nsem fim": "shell-ilegivel",
  };
  for (const [c, r] of Object.entries(casos)) assert.equal(negarShell(c), r, c);
});

test("o falso positivo aceito segue negado: código que escreve num arquivo comum e cita um protegido no texto (T109)", () => {
  assert.equal(negarShell(FP_ACEITO), "arquivo-protegido");
});
