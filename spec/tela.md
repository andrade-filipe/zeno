# Tela: como o Zeno escreve para a pessoa (D40, T88)

O que a pessoa lê no terminal decide gate. Texto ilegível vira carimbo (D36). As regras abaixo valem para todo verbo que
a pessoa lê: `caixa --aprovar`, `gate --aprovar`, `status`, `pendentes`, `caixa` e `promover`. O código fica em
`core/tela.mjs` (o como) e `core/vista.mjs` (o quê, de um gate).

## Regras
1. **Resumo antes do detalhe.**
   - Com mais de um item, primeiro vem uma tabela de uma linha por item.
   - O detalhe abre sozinho só para o que pede olho; o resto abre sob demanda (`v N`, `--detalhe`, `--completo`).
   - Na caixa, pede olho o gate de risco alto, de tipo segurança, MUDOU ou com cartão sem nível.
2. **Rótulos numa coluna.**
   - Rótulos curtos (Muda, Porquê, Risco, Desfazer, Reprovar, Conferir), alinhados.
   - As continuações recuam até a coluna do valor.
   - Uma lista (o conferir) vira itens numerados.
3. **Largura do terminal.**
   - Tudo quebra ou corta na largura: `ctx.colunas`, limitada a 60–100 colunas, com 80 sem TTY.
   - Corte por palavra, com "…". Nenhuma linha passa da largura (o probe confere).
4. **Cor com parcimônia.**
   - Só em TTY, sem `NO_COLOR`, sem `TERM=dumb` e nunca com `--json`.
   - Negrito no cabeçalho, vermelho no ALTO, amarelo no MUDOU, fraco no sha.
   - Nada é dito só pela cor: o ALTO e o MUDOU também estão no texto.
5. **O discreto vai no fim:** o id, o ref e o sha ficam alinhados à direita, na última linha do item.
6. **Quem escreve também conta** (lint do cartão, [fases](fases.md)):
   - 160 caracteres por campo e 100 por item do conferir;
   - o risco começa por `alto:`, `baixo:` ou `nenhum:`.
7. **Outra porta lê o `--json`** (D39): `pendentes --json` leva a vista inteira de cada gate (o cartão por campo, o tipo,
   o nível, o MUDOU e o sha). Ninguém raspa o texto da tela.
8. **T16:** só o `cli.mjs` lê `process.stdout.columns`, `isTTY` e `NO_COLOR`. O core recebe `ctx.colunas` e `ctx.cor`.

## O tipo de uma mudança (na caixa)
Sai do diff dos commits do `ref` da Entrega, não de quem escreve:
- **segurança:** toca `guardas.json`, `seguranca.md`, o shell, os protegidos, a assinatura, o guarda, o lançador ou o
  proxy, ou um `.githooks/`; ou acrescenta uma guarda `/*G:*/`;
- **docs:** só `.md`, fora do `.agents/`;
- **código:** o resto;
- **registro:** sem commit, isto é, Especificação, retro ou só nós do `.agents/`.

## A caixa, a 80 colunas
O snapshot está em `test/fixtures/tela/caixa-80.txt` (e `caixa-100.txt`). Quando a saída muda de propósito, ele é
refeito com `ZENO_SNAPSHOT=1 node --test test/probes/caixa-legivel.test.mjs`, e o diff vai no commit.
