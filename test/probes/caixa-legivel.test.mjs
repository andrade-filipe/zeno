// probe caixa-legivel (D40): a caixa abre com o resumo e expande sozinha o que pede olho (risco alto); o de risco baixo
// fica fechado. A saída sem cor bate com o snapshot a 80 e a 100 colunas, e nenhuma linha passa da largura; com cor, o
// ALTO também está no texto (nada só por cor). Atualizar o snapshot: ZENO_SNAPSHOT=1 node --test <este arquivo>.
import { test } from "node:test"; import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"; import { join } from "node:path";
import { alvo, noM } from "../ajuda.mjs";

const FIX = new URL("../fixtures/tela/", import.meta.url).pathname;
const cartao = (risco) => ["--pronto", "o teste passa", "--restricoes", "nenhuma", "--riscos", "baixo",
  "--cartao-muda", "Num repo adotado, o bloco do Zeno sai do AGENTS.md commitado e chega ao agente pelo SessionStart, junto com as travas.",
  "--cartao-porque", "O bloco ia para toda sessão do time; as travas, só para a sua máquina (D39).", "--cartao-risco", risco,
  "--cartao-desfazer", "git revert ee356f5; zeno sync no alvo adotado", "--cartao-reprovar", "reabro a Execução; o bloco segue no AGENTS.md",
  "--cartao-conferir", "(1) o pelaPorta em core/verbos/instalar.mjs; (2) o probe test/probes/adocao-intacta.test.mjs; (3) se quer uma sessão real"];

test("probe caixa-legivel", async () => {
  const A = await alvo();
  const a = await noM(A, "Testes apagam as pastas temporárias que criam");
  assert.equal((await A.z(["avancar", a, "--ate", "fim", ...cartao("baixo: a prova das guardas mudou de lugar no disco")])).codigo, 3);
  const b = await noM(A, "O bloco do AGENTS.md só vale onde o Zeno está instalado");
  assert.equal((await A.z(["avancar", b, "--ate", "fim", ...cartao("alto: conferido na doc, não numa sessão real; uma subpasta fica sem bloco e sem travas.")])).codigo, 3);
  const tela = async (colunas, cor = false) => {
    const visto = [];
    await A[cor ? "cru" : "z"](["caixa", "--aprovar"], "pessoa", { colunas, cor, mostrar: (t) => visto.push(t), perguntar: async () => "" });
    return visto.join("\n") + "\n";
  };
  for (const w of [80, 100]) {
    const t = await tela(w), arq = join(FIX, `caixa-${w}.txt`);
    for (const l of t.split("\n")) assert.ok(l.length <= w, `linha de ${l.length} > ${w}: ${l}`);
    assert.match(t, /^ 2 +Especificação +registro +ALTO +O bloco/m);
    assert.match(t, /── 2 · Especificação · O bloco do AGENTS\.md/, "o de risco alto abre sozinho");
    assert.doesNotMatch(t, /── 1 · /, "o de risco baixo fica fechado");
    if (process.env.ZENO_SNAPSHOT || !existsSync(arq)) { mkdirSync(FIX, { recursive: true }); writeFileSync(arq, t); }
    assert.equal(t, readFileSync(arq, "utf8"), `a caixa a ${w} colunas mudou (snapshot ${arq})`);
  }
  const c = await tela(80, true);
  assert.match(c, /\x1b\[31mALTO\x1b\[39m/); assert.match(c.replace(/\x1b\[[0-9;]*m/g, ""), /ALTO · conferido na doc/);
  const j = await A.z(["pendentes", "--de", "ana"]);
  const g = j.j.dados.gates.find((x) => x.no === b);
  assert.equal(g.nivel, "alto"); assert.equal(g.tipo, "registro"); assert.equal(g.cartao.conferir.length, 3); assert.equal(g.mudou, false);
});
