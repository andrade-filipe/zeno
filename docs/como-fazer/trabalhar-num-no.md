---
tipo: como-fazer
publico:
  - usuario
  - agente
responde: "Como passo um nó médio ou grande pelas fases, com contexto, mensagens e registro do que foi feito fora?"
fonte:
  - zeno/spec/cli.md
  - zeno/spec/fases.md
  - zeno/spec/mensagens.md
  - zeno/spec/seguranca.md
verificado-em: 6ae3549
---

# Trabalhar num nó médio ou grande

**Resumo.** Crie o nó com `zeno novo --tamanho`. Antes de cada fase de um nó grande, monte o contexto com
`zeno contexto <id>`. Avance com `zeno avancar <id>`, passando as chaves da fase. Converse no fio do nó com
`zeno msg`. Trabalho já feito fora do Zeno entra com `zeno registrar --retro`.

**Quando:** o trabalho não cabe na via expressa (tamanho `M` ou `G`, ou faixa acima de `autonoma`).
**Antes:** um alvo instalado ([Instalar](instalar-num-repo.md)).

## 1. Crie o nó

O nó vem antes da primeira edição no alvo: é o primeiro ato do agente, e o bloco do Zeno no `AGENTS.md` abre com essa
regra (T113).

```sh executavel
cd "$(mktemp -d)"   # um diretório descartável
git init -q -b main alvo && cd alvo && zeno install . > /dev/null
zeno novo "Atualizar a dependência" --tamanho M
```
```text saida
atualizar-a-dependencia
```

A saída é o id do nó. O `--tamanho` é obrigatório e não tem padrão, porque um padrão caro ou barato seria uma escolha
escondida. Um filho entra com `--pai <id>`, e o orçamento do filho sai do saldo do pai. Se o trabalho cresceu, suba o
tamanho com `zeno ajustar <id> tamanho=M`: a faixa sobe junto até o piso do tamanho novo (T115), e o próximo gate de
Especificação ou Entrega passa a ser de pessoa.

## 2. Monte o contexto da fase

```sh executavel
zeno contexto atualizar-a-dependencia --fase intencao | head -n 5
```

O pacote junta o `AGENTS.md` do alvo, o nó, a Especificação do pai e o cartão da fase. Também entram as skills que o
módulo liga àquela fase, as `refs` do nó e até 3 lições do alvo. Na Execução, na Verificação e na Entrega entra
também o bloco "Ferramentas deste alvo", com o cartão de cada ferramenta de terminal (Ver as ferramentas).
Use o pacote para começar uma fase numa sessão nova. O
tamanho do pacote vai para o ledger, porque contexto é custo do Sistema.

## 3. Avance fase a fase

O `zeno avancar` sem `--ate` tenta sair só da fase atual. Ele escreve as chaves passadas na seção certa do corpo do nó
e roda o gate.

```sh executavel
zeno avancar atualizar-a-dependencia \
  --porque "a versão atual tem uma falha conhecida" --para "quem roda o projeto" --fora "trocar de biblioteca"
```
```text saida
Intenção → Especificação
```

As chaves de cada fase estão nos [cartões](../../spec/fases.md#os-cartões-módulo-nucleo). Num nó `M` ou `G`, a
Intenção também pede `para` e `fora`, e a Especificação pede `restricoes` e `riscos`. Se falta uma chave, a CLI para
e diz qual (saída 1). Isso não conta tentativa.

Com `--ate fim`, a CLI passa fase a fase até o primeiro gate humano e para ali com a saída 3. O gate humano precisa do
cartão de decisão: veja [Aprovar um gate](aprovar-um-gate.md).

**A Observação espera a janela (T102).** Sem `--janela` no `zeno novo`, a janela da Observação sai do tamanho: 3 dias
num nó `P` e 7 num `M` ou `G`. A via expressa e o `registrar --retro` seguem em `0d`. Sair da Observação antes do prazo
com `--observado` é recusado (regra `janela`), e o `zeno pendentes` só acusa a Observação vencida depois dele. A janela
fica gravada quando o nó nasce, e um nó que já existia não muda.

## 4. Converse no fio

As mensagens do nó ficam no fio (`.agents/trabalho/<id>.fio.md`), append-only. São 7 tipos, cada um com campos
obrigatórios: `pedido`, `pergunta`, `resposta`, `decisao`, `entrega`, `escalada` e `aviso`
([mensagens](../../spec/mensagens.md#os-7-tipos-e-os-campos-obrigatórios)).

```sh executavel
DONO=$(sed -n 's/^  dono: //p' .agents/sistema.yaml)   # o id da pessoa dona do alvo
zeno msg atualizar-a-dependencia pergunta --para "$DONO" \
  --contexto "a versão nova muda a API de leitura" --opcoes "atualizar agora; esperar a próxima" \
  --recomendacao "atualizar agora" --bloqueia "a Especificação"
```

O lint recusa uma mensagem sem campo obrigatório, com a saída 1. A pessoa vê o que espera por ela com
`zeno caixa` e `zeno pendentes`.

## 5. Registre o gasto e o que foi feito fora

- **O gasto.** Na porta do Claude Code, o gasto entra sozinho (T103). Cada `zeno novo`, `avancar` e `registrar` mede a
  sessão pelo transcript, achado pela `CLAUDE_CODE_SESSION_ID`, com os transcripts dos subagentes. A medição é por
  diferença contra a anterior da mesma sessão e vai para os nós da chamada (`fonte: medido`). O hook `SessionEnd` grava
  só o que falta. Fora dessa porta, declare: `zeno registrar gasto <id> --tokens N`. O gasto declarado conta para o disjuntor, mas não dá a fração
  do Sistema no placar. Um gasto acima do teto pausa o nó na hora (saída 4), e nada avança até uma pessoa soltá-lo
  ([o código 4](quando-algo-e-negado.md#o-código-de-saída)).
- **O trabalho feito fora do Zeno** entra depois, com as 7 fases marcadas `retro`. O desvio vira dado. O Zeno pede
  esse registro em dois pontos (T113): o hook `Stop`, no fim da conversa com edição sem nó, e o commit de agente sem
  nó, que para até o registro entrar. Os dois trazem o comando pronto, com o `--inicio` e o `--fim`:

```sh executavel
zeno registrar "Corrigir um typo à mão" --retro --tamanho P \
  --inicio 2026-11-02T10:00:00Z --fim 2026-11-02T10:05:00Z \
  --porque "typo no README" --pronto "o typo sumiu" --feito "README.md" \
  --evidencia "git diff" --ref README.md --desfazer "git revert"
```
```text saida
Aprendizado → fechado
```

Se a faixa efetiva não é `autonoma` e quem registra é agente, o registro para no gate humano da Entrega. O retro não
fura a faixa.

**Conferir:** `zeno status <id>` mostra a fase, a faixa efetiva, o consumo de cada dimensão contra o teto, o histórico
de gates e as mensagens abertas.
