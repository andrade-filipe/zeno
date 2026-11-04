# Domínio: fluxo, etapa e garantia

Este documento diz **o que o Zeno é** e para onde o desenho vai. Ele especifica fluxo, etapa e garantia, mas não os
constrói. A origem é a grelha de domínio do vault do Filipe (`1 Projects/Zeno/grelha-2026-11-03-dominio.md`).
As linhas de código citadas foram conferidas no commit `74c5765`.

**Como ler.** Toda seção traz uma linha `Hoje:` (o que tem código, com `arquivo:linha`) ou `Plano:` (com o horizonte:
curto, médio ou longo). O que é plano nunca está escrito no presente. Os caminhos de código são relativos a `zeno/`,
salvo os que começam por `avaliacao/`.

## 0. A frase e os princípios

> O Zeno é uma plataforma local de SDLC para agentes de IA: cada trabalho é um nó que cumpre 7 garantias pelo caminho
> mais barato, os fluxos são grafos de etapas versionados que nascem do uso, e toda regra é imposta pela máquina e
> medida pelo próprio registro.

É a frase do **desenho**.
- Hoje: três partes dela têm código: o nó com 7 fases (`core/util.mjs:4`), a regra imposta pela máquina (a saída de
  fase com gate, `core/fluxo.mjs:183`) e a medida pelo registro (o ledger só cresce, `core/ledger.mjs:38`).
- Plano: a garantia derivada, o fluxo versionado e a receita são de médio prazo.

**Os princípios.**
1. **Os meios não viram o fim.** Todo mecanismo paga o próprio custo em produtividade real. O teto do imposto vale
   para a primeira aplicação e para todas as seguintes.
2. **O conhecimento informa; o controle impõe.** O fluxo é controle: determinístico, versionado e lido pela CLI. O
   conhecimento só sugere.
3. **O software grita o domínio.** O que aparece para quem usa fala os termos do [glossário](../docs/glossario.md),
   em PT-BR, e nunca os números internos das decisões.

**O que sustenta o desenho.** A evidência do hub é fraca: no máximo um achado moderado por tema. A favor: o nó dono do
próprio contexto, com o estado passado em arquivo; o verificador separado de quem executa; um agente com a skill
certa no lugar de vários agentes por papel; o fluxo declarado barato. Contra a cerimônia: especificar demais custa
tempo e rende pouco. O desenho é uma **hipótese a medir no placar**.

## 1. O que é o Zeno

O Zeno é **a plataforma**: local, sem custo e com um nome só, para explicar e para publicar. A disciplina mora em três
invariantes:
1. quem executa não avalia, e a avaliação nunca muda estado;
2. o Zeno funciona sozinho, sem serviço;
3. toda ferramenta externa é opcional e só lê o que o Zeno exporta.

**As camadas.** Cada uma tem um tipo, e o tipo diz quanto construir.

| Tipo | Camadas | O que fazer |
|---|---|---|
| Domínio central | criação, ajuste e aprendizado de fluxos · controle · decisão humana · identidade, segurança e fronteiras | construir fundo |
| Suporte | acoplamento às ferramentas · conexão com o conhecimento · estado e federação · distribuição · avaliação | construir fino, com contrato |
| Genérico | rastros e tokens · ferramentas de engenharia · painéis · execução e orquestração (talvez) | o agente opera pelo terminal; ferramenta local opcional |

**A escada das ferramentas de terminal.** O agente é o integrador, então o Zeno ensina antes de integrar:
1. ensinar, com skill e cartão;
2. verificar presença e login, sem ler segredo;
3. registrar a evidência sozinho;
4. governar, casando o comando com a ação da tabela de faixas;
5. um adaptador dedicado, só para evento.

Os degraus 3 e 4 sobem por sinal do placar.

**A escada das ferramentas de mercado** (local, custo zero, sem servidor):
1. só o Zeno, que tem de bastar;
2. uma CLI local;
3. um container sob demanda, que só lê o que o Zeno exporta;
4. um servidor, só num futuro hipotético de time.

A licença de cada ferramenta é conferida antes do degrau 3.

- Hoje: a CLI é a única porta de escrita do estado, e todo fato entra no ledger por um só ponto (`core/ledger.mjs:38`).
  A avaliação só lê (`avaliacao/placar/placar.mjs:9`).
- Plano: verificar e ensinar as ferramentas de terminal é de curto prazo; os degraus seguintes sobem pelo placar.

## 2. Garantia

A fase é uma **garantia**, não um passo. Todo trabalho cumpre as 7, e cada uma é cumprida pelo caminho mais barato,
nesta ordem de preferência:
1. **derivada** pela máquina (do git, de um check, do ledger ou do pai);
2. **herdada** do ancestral;
3. **escrita** pelo agente, em uma linha;
4. **assinada** por uma pessoa, só quando a faixa exige.

A **estratégia de execução** é livre por nó: tentativa direta, planejar e executar, testes primeiro, pipeline fixo,
subagentes. Ela é a variável dos experimentos de context engineering. A métrica perseguida é o custo por nó comparado
com a complexidade do nó.

Ressalvas:
- num nó pequeno o ganho é modesto, porque a via expressa já é quase isso;
- o desfazer derivado (reverter o commit) só vale para trabalho que é um commit de código;
- ainda não se sabe quanto o próprio Zeno gasta: na apuração da grelha, a medição de gasto pegou 2 de 52 sessões.

- Hoje: a fase é um passo. Cada fase exige o seu artefato (`core/fluxo.mjs:11`), e o gate decide a saída
  (`core/fluxo.mjs:183`). A faixa escolhe entre gate check e gate humano (`core/projecao.mjs:16`). A decisão humana é
  assinada e conferida (`core/assinatura.mjs:54`). A via expressa, só para nó pequeno e de faixa autônoma, encurta o caminho
  (`core/verbos/escrita.mjs:103`).
- Plano: a garantia derivada e a herdada são de médio prazo.

## 3. Fluxo

O **fluxo** é a definição de um jeito de trabalhar: um grafo de **etapas**, versionado, que a CLI lê e impõe. O
**trabalho** é a instância: os nós. É a mesma separação entre classe e objeto, ou entre o desenho de um processo e um
caso dele.

As 7 garantias são o bloco fundador e não mudam. O que muda de um processo para outro é o grafo: **o fluxo mora entre
os nós, não dentro deles.** Um nó se especializa pelo contexto que recebe, nunca por outro agente nem por outras fases.

- Hoje: existe o grafo de trabalho (pai, dependências e arestas no frontmatter, `core/no.mjs:9`), mas nenhuma
  definição de fluxo. Os nós de hoje contam como o **fluxo implícito, versão 0**.
- Atenção ao nome: `core/fluxo.mjs` é a saída de fase (artefato, gate, disjuntor), não o fluxo deste documento.
- Plano: o fluxo e a etapa versionados são de médio prazo.

## 4. Etapa

A **etapa** é um ponto do fluxo. Ela traz:
- o ponteiro de conhecimento (de onde vem o contexto especializado);
- a faixa;
- os checks;
- a estratégia padrão;
- as garantias que ela costuma derivar ou herdar.

Cada etapa executada vira **um nó com as 7 garantias**, e o nó registra **fluxo, versão e etapa**. Esses três campos
provavelmente tomam o lugar do campo `modulo`.

**A porta aberta.** Uma etapa pode cumprir uma garantia do pai sem nó próprio, mas só se a garantia for derivada pela
máquina.

- Hoje: não há etapa. O campo `modulo` existe e é inerte: o nó novo grava sempre `nucleo`
  (`core/verbos/escrita.mjs:88`), e o contexto lê sempre o módulo `nucleo`, seja qual for o campo
  (`core/verbos/leitura.mjs:129`).
- Plano: médio prazo, junto com o fluxo.

## 5. Receita

A **receita** é um fluxo promovido. Ela nasce do uso, numa escada:
1. o grafo começa **emergente**: os nós se ligam como o trabalho pede;
2. um padrão que funciona vira **proposta de receita** (o conhecimento pode sugerir);
3. uma pessoa **promove** a proposta;
4. a CLI **impõe** a receita promovida.

**Uma volta é um nó novo.** Quando a verificação reprova, nasce um nó de correção. A fase de um nó nunca anda para trás.

Um agente assíncrono pode curar padrões e propor receitas. Ele usa modelo pago e pede o aceite da pessoa. Ele nunca
decide o fluxo de um nó em tempo real. A decisão de gate por modelo só existe pela escada de autonomia, começando em
modo sombra.

- Hoje: não há receita, e a fase não volta. Mudar uma seção já aprovada reabre o gate daquela fase
  (`core/fluxo.mjs:189`); isso não é uma volta de fase.
- Plano: as receitas promovidas à mão são de médio prazo. A detecção automática de padrões e o juiz em modo sombra
  são de longo prazo.

## 6. Contrato de fonte de conhecimento

O contexto especializado de uma etapa vem numa escada:
1. até 3 skills compactas por etapa, embutidas no fluxo;
2. uma consulta determinística, sem modelo, a uma base de conhecimento, pelos atributos do nó, na montagem do pacote;
3. a consulta feita pelo próprio agente, por um servidor de ferramentas.

Toda base segue o **contrato de fonte de conhecimento**:
- buscar, ler e dar conselho por domínio;
- nunca roda modelo;
- filtra a saída;
- fica separada por fronteira.

O formato pode ser o do hub. O teto de bytes por camada é medido.

Por que a escada: a evidência do hub aponta skills curadas como úteis (moderada), skills compactas e poucas como
melhores (fraca), a obediência caindo a zero com dezenas de regras (fraca) e memória longa perdendo de 30 a 60%
(moderada).

- Hoje: o pacote de contexto já é montado em camadas: AGENTS.md, o nó, o cartão da fase, as skills da fase, as
  referências e as lições (`core/verbos/leitura.mjs:131`). As skills vêm do módulo `nucleo`, por fase, não por etapa
  (`core/verbos/leitura.mjs:139`). Os bytes de cada camada vão para o ledger (`core/verbos/leitura.mjs:156`).
- Plano: o contrato e a consulta por atributos são de médio prazo. A consulta pelo agente vem depois deles, sem prazo
  marcado na grelha.

## 7. Contrato de porta

A **porta** é o adaptador de uma ferramenta de agente. O **contrato de porta** tem 5 níveis, e cada um pressupõe os
anteriores:

| Nível | Nome | O que a ferramenta faz |
|---|---|---|
| 0 | Operar | o agente usa a CLI (ou um servidor de ferramentas), mais o pre-commit |
| 1 | Contexto | a ferramenta injeta o pacote de contexto |
| 2 | Guardar | a guarda roda antes de cada ferramenta |
| 3 | Medir | a ferramenta avisa a contaminação e o gasto |
| 4 | Isolar | o agente roda no `zeno sessao`; só aqui a identidade é real |

Um servidor de ferramentas dá operabilidade, não imposição: ele é o canal do nível 0. Um **verificador** diz em que
nível está a ferramenta.

- Hoje: a porta do Claude Code é a primeira, e o contrato mínimo dela está em [portas.md](portas.md). A guarda antes
  da ferramenta existe (`core/verbos/guarda.mjs:66`). A contaminação e o gasto são medidos
  (`core/verbos/guarda.mjs:108`, `core/verbos/guarda.mjs:132`), e o gasto só entra no fim da sessão. O isolamento é o
  `zeno sessao` (`core/verbos/lancar.mjs:117`).
- Plano: o contrato em níveis, o verificador e a segunda porta são de médio prazo. O que limita o nível da segunda porta
  são os pontos de extensão da ferramenta, ainda em aberto.

## 8. Dados entre repositórios

Cada repositório guarda o próprio ledger. Entre eles há **federação local por leitura**:
- o registro de alvos lista os ledgers e as fronteiras;
- a avaliação agrega por fronteira;
- nada é copiado;
- o resultado de alvo da empresa ou de cliente nunca é gravado no monorepo pessoal;
- os painéis só leem o que a avaliação exporta.

Os papéis: **observar** é do Zeno, o único que escreve; **avaliar e analisar** é da avaliação, que só lê;
**visualizar** lê os dois.

- Hoje: o placar lê um ledger por alvo e não escreve em nenhum (`avaliacao/placar/placar.mjs:9`,
  `avaliacao/placar/placar.mjs:21`). A fronteira do alvo é lida do `sistema.yaml` (`core/config.mjs:83`). Ainda não
  há registro de alvos: os ledgers são passados à mão.
- Plano: os painéis federados são de longo prazo. A grelha não marca prazo para o registro de alvos.

## 9. Confiança graduada

A assinatura da pessoa é o selo do sistema. A confiança nela sobe numa escada:
1. o ledger marca se cada ato veio de dentro ou de fora do sandbox, e o discurso diz a verdade: uma assinatura dada
   com o agente fora do sandbox não tem prova de isolamento;
2. o sandbox fica obrigatório, primeiro na fronteira empresa ou cliente e na faixa `nunca`, depois de resolver a
   conversa entre sessões dentro dele;
3. a cópia das guardas passa a ser do root, antes da primeira versão pública;
4. a chave física.

- Hoje: a decisão humana é assinada e conferida (`core/assinatura.mjs:54`). O `zeno sessao` isola o agente
  (`core/verbos/lancar.mjs:117`). Dentro dele, o ator vem de um marcador que o agente não cria (`core/sessao.mjs:13`).
  O ledger registra a abertura e o fechamento da sessão (`core/ledger.mjs:11`), mas não marca cada ato. Fora do
  sandbox, a identidade do agente é declarada por ele mesmo. O código da cópia do root existe (`core/root.mjs:1`); falta
  a pessoa rodar os passos com root.
- Plano: a marca de dentro e fora e os passos com root são de curto prazo. O sandbox obrigatório na fronteira empresa é
  de médio prazo. A chave física é de longo prazo.

## 10. Ordem de construção

As receitas nascem do uso, então usar agora é a matéria-prima do desenho.

| Horizonte | Lema | O que entra |
|---|---|---|
| Curto | usar e medir | o roteiro de curto prazo do vault; a marca de dentro e fora do sandbox; os passos com root; verificar e ensinar as ferramentas de terminal; corrigir a spec, a apresentação e as respostas; este documento; o estudo de posicionamento |
| Médio | construir pelo dado | o fluxo e a etapa versionados; as garantias derivadas e herdadas; as receitas promovidas à mão; o contrato de porta, com a segunda porta; o contrato de fonte de conhecimento, com a consulta por atributos; o sandbox obrigatório na fronteira empresa |
| Longo | escalar o que provou | a detecção automática de padrões em receitas; os painéis federados; o juiz em modo sombra; o executor assíncrono; a chave física |

**Riscos aceitos.**
- A primeira versão pública sai antes do núcleo novo, e a interface vai mudar: é uma versão 0.x, dito com todas as
  letras.
- Os nós de hoje contam como o fluxo implícito, versão 0.

Plano: esta seção inteira é plano; o horizonte de cada item está na tabela.

## 11. Hoje e plano

| Conceito | Hoje (código) | Plano |
|---|---|---|
| nó com 7 fases | `core/util.mjs:4` | as fases viram garantias (médio) |
| regra imposta pela máquina | `core/fluxo.mjs:183` | a receita imposta pela CLI (médio) |
| medida pelo registro | `core/ledger.mjs:38` | — |
| garantia derivada ou herdada | não há | médio |
| garantia assinada | `core/assinatura.mjs:54` | — |
| fluxo e etapa versionados | não há; `modulo` é inerte (`core/verbos/escrita.mjs:88`) | médio |
| receita | não há | promovida à mão (médio); detectada sozinha (longo) |
| contrato de fonte de conhecimento | contexto em camadas (`core/verbos/leitura.mjs:131`) | médio |
| contrato de porta | a porta do Claude Code ([portas.md](portas.md)) | níveis e verificador (médio) |
| federação por leitura | o placar lê ledgers à mão (`avaliacao/placar/placar.mjs:21`) | painéis federados (longo) |
| confiança graduada | assinatura e `zeno sessao` (`core/verbos/lancar.mjs:117`) | marca e root (curto); sandbox obrigatório (médio); chave física (longo) |
