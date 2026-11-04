# Controle: faixas, gates, procedência, orçamento

## Faixas (D13)

| Faixa | Sentido | Quem executa |
|---|---|---|
| `autonoma` | o agente faz e os gates são check | pessoa ou agente |
| `aprovacao` | o agente faz; Especificação e Entrega passam por pessoa | pessoa ou agente |
| `nunca` | o agente não executa (prod, dinheiro, publicação, chaves, fronteira com a empresa). Nunca é promovida. | **só pessoa** (o agente pode rascunhar artefato) |

**Faixa efetiva** = a mais restritiva (`autonoma < aprovacao < nunca`) entre:
1. a `faixa` declarada no nó;
2. o **piso por tamanho** (`padrao[tamanho]` do `faixas.yaml`): um agente nunca declara abaixo dele; uma pessoa pode, e isso é um afrouxar assinado. **T115:** o piso vale também quando o tamanho sobe. O `zeno ajustar` que sobe o tamanho (P→M, P→G, M→G) e deixa a faixa declarada abaixo do piso do tamanho novo grava, no mesmo comando, o `ajuste` de `faixa` até o piso (com `motivo: tamanho`) e o `faixa.alterada` com `motivo: tamanho`. É um apertar, livre para o agente; nunca baixa a faixa. Só a pessoa que declara a faixa no mesmo ajuste fica com a dela. A regra é do verbo, não da `faixaEfetiva`: os nós antigos não mudam no replay;
3. a faixa de cada ação em `acoes`;
4. a procedência: `nao-confiavel` ⇒ no mínimo `aprovacao` (D15) — **exceto** no nó da via expressa de código do zeno
   (`novo --expressa --codigo`, T76): ali a procedência não sobe a faixa, porque o código só chega às guardas pelo
   `zeno promover` (assinado, com testes, censo e a lista de commits e nós), e o gate humano repetia esse ato (D36).
   Na Entrega, o commit da `ref` tem de ficar em `cli.mjs`, `core/`, `bin/`, `modulos/` ou `test/*.test.mjs`, mais
   `spec/decisoes-tecnicas.md` **só por acréscimo** (0 linhas removidas nele; T79); qualquer outro arquivo — o resto
   de `spec/`, `.agents/`, outras raízes, e a **prova das guardas** (`guardas.json`, `test/probes/`,
   `test/censo.mjs`, `test/ajuda.mjs`, `test/fp-shell.mjs`, `test/fixtures/`) — reprova o gate check (guarda
   `expressa-codigo`). Para seguir, `zeno ajustar <id> faixa=aprovacao` (apertar é livre) e o gate vira humano, com cartão.
   O piso das ações (3) e a herança (5) continuam valendo; o nó segue `nao-confiavel`;
5. a herança: filho de nó com faixa efetiva `nunca` é `nunca`.

A faixa efetiva é derivada a cada chamada; nunca é escrita.

### `.agents/faixas.yaml`

```yaml
zeno: 1
padrao:                 # piso da faixa por tamanho
  P: autonoma
  M: aprovacao
  G: aprovacao
gates:                  # quem aprova cada gate humano, por faixa efetiva (papéis do nó)
  aprovacao:
    especificacao: [revisor]
    entrega: [dono]
  nunca:
    especificacao: [revisor]
    verificacao: [revisor]
    entrega: [dono]
acoes:                  # linhas do módulo + linhas locais do alvo
  entrega.push-main:    # push para um main remoto compartilhado (não o commit local)
    faixa: aprovacao
    aprova: [dono]      # se presente, substitui os papéis do gate de entrega
  entrega.publicar:
    faixa: nunca
  gasto.usd:
    faixa: nunca
  fronteira.saida:
    faixa: nunca
  modulo.atualizar:
    faixa: aprovacao
```

- Fase que não aparece em `gates` = gate `check`.
- **Piso do módulo em tempo de execução:** a CLI usa, a cada chamada, o **máximo** entre o `faixas.yaml` do alvo e o
  `faixas.yaml` do módulo (`padrao`, `gates` e `acoes`). Uma linha local só aperta; afrouxar o piso é mudar o módulo
  (`modulo.atualizar`). O `validar` acusa a linha local mais frouxa que o módulo (`faixas-piso`).
- `faixas.yaml` e `sistema.yaml` são canônicos de **pessoa**: negados ao agente nas camadas 1 e 2 ([seguranca](seguranca.md)),
  e todo evento grava o `config_sha256` deles, para a mudança de configuração ficar visível no ledger.
- Papel → pessoa: o `dono`/`revisor`/`executor` do nó. Se o papel de um gate humano resolve para um agente, a CLI recusa
  criar o nó (`papel`).

## Gates (D13)

| Tipo | Inc. 1 | Quem decide | Como |
|---|---|---|---|
| `check` | sim | a CLI | as regras do cartão + os `checks` do nó; código 0 = aprovado |
| `humano` | sim | uma pessoa com o papel da tabela | `zeno gate <id> --aprovar/--reprovar`, **assinado** (abaixo) |
| `juiz` | **formato só** | um juiz da `avaliacao/` (Inc. 4) | a CLI aceita o tipo e sai com 6 (não implementado) se for o único gate |

**Fluxo:** `zeno avancar <id>` tenta sair da fase atual.
- Falta chave obrigatória do artefato ⇒ saída 1 e evento `artefato.incompleto`. **Não** é gate reprovado e não conta tentativa.
- gate `check`: roda os `checks` **fora da trava** e revalida com a trava; aprovado ⇒ `gate.decidido` + `fase.avancou`;
  reprovado (um check saiu ≠ 0) ⇒ `gate.decidido(reprovado)`, tentativa +1, fica na fase (saída 1).
- gate `humano`: o artefato tem de estar completo, **com o cartão de decisão** ([fases](fases.md), T75; sem ele, saída 1 e
  `artefato.incompleto`); ⇒ `gate.aberto`, `estado: em-gate`, saída 3. Depois, `zeno gate <id>` (ou a `caixa --aprovar`)
  mostra as seções até a fase e o cartão inteiro, pede a decisão e a passphrase, e grava o `gate.decidido` assinado; aprovado ⇒ `fase.avancou`;
  reprovado ⇒ `estado: ativo`, tentativa +1.

### Decisão humana assinada
O agente controla o ambiente (TTY falso com `script`, `CLAUDECODE` removido num script, escrita direta no ledger com
`node -e`). Por isso **ambiente não prova pessoa; só a passphrase prova** (o mesmo aprendizado do `sign.mjs` do hub).
- Cada pessoa tem um par Ed25519: a chave privada num PEM **cifrado por passphrase** em `~/.config/zeno/<pessoa>.key`
  (pasta que o guarda global de chaves já nega ao agente); a pública em `sistema.yaml → pessoas.<p>.chave_pub`.
  `zeno chave nova` gera o par (só no terminal da pessoa).
- São **eventos assinados**: `gate.decidido` humano, `orcamento.alterado` para cima, `ajuste` que afrouxa, `no.cancelado`
  de nó fora da faixa `autonoma`, `contaminacao.limpa`, e o fechamento de `registrar --retro` fora da `autonoma`.
- Assinatura = Ed25519 sobre o JSON canônico do evento sem o campo `assinatura` (chaves em ordem, sem espaço). Campo
  `assinatura: {pessoa, sig}` no evento ([ledger](ledger.md)).
- **A projeção só honra evento assinado** com chave pública válida. Um `gate.decidido` humano sem assinatura válida é
  erro do `validar` (`assinatura`) e não avança o nó.
- O `gate.decidido` humano assina também o `artefato_sha256` das seções até a fase decidida. Se uma seção aprovada
  mudar depois, o `validar` acusa (`aprovado-mudou`) e a CLI reabre o gate daquela fase no próximo `avancar`; o
  `status` e o `pendentes` dizem que falta reabrir. Com o gate reaberto, a seção mudada vira aviso no `validar` (a
  decisão nova continua exigida, e a Execução não anda em-gate); sem ele, segue erro (T87).
- **Nó em revisão (T87):** o agente tira da caixa o gate de um nó que está revendo com `zeno revisar <id> --motivo`
  (apertar é livre: só adia, nunca aprova; evento `gate.retirado`). E a caixa marca **MUDOU** e tira do "todos" o gate
  cujo texto mudou depois de aberto: só se aprova por número.
- Barreira extra (não prova, só filtra): o verbo exige TTY e ausência de `CLAUDECODE`, como o `portao-llm`.

**Formato pronto para o Inc. 4** (o MVP lê e ignora):
```yaml
  aprovacao:
    especificacao: [revisor]
    especificacao_sombra:
      tipo: juiz
      id: juiz-spec
      k: 10              # promoção depois de k concordâncias seguidas (D13)
```
O `gate.decidido` já carrega `modo: real | sombra` e `decisor.tipo`. Promoção e rebaixamento entram como eventos
`gate.promovido`/`gate.rebaixado` (compatível com o ledger v1).

### A grelha dos gates humanos
Para cada fonte de gate humano, a pergunta é: ele protege algo que uma guarda com sonda já não garante? O que só
repete uma guarda vira check; o resto fica com a pessoa e com o cartão. Um gate vira humano por quatro vias: a faixa
por tamanho (M e G vão para `aprovacao`, `modulos/nucleo/faixas.yaml`), a procedência não confiável
(`core/projecao.mjs`, guarda `procedencia`), uma ação com `aprova` e a reabertura de seção aprovada que mudou.

O **n** conta os primeiros 84 gates humanos do ledger do `zeno/` (de 2026-11-02 22:16 a 2026-11-03 15:08 UTC), pela
linha em que cada um cai.

| Fonte do gate humano | O que protege | Guarda que já garante (sonda) | n | Veredito |
|---|---|---|---|---|
| Especificação de M e G | o rumo: o que vai ser feito, antes do custo | nenhuma | 26 | fica |
| Entrega de M e G, commit só no código do `zeno/` (mais acréscimo em `spec/decisoes-tecnicas.md`) | que código novo não passa a guardar sem a pessoa ver | o `promover` assinado: lista os commits, roda a prova isolada e só troca a cópia que guarda com a passphrase (`promover-entrega`, `prova-isolada`, `assinatura`) | 0 | repetiria uma guarda, mas fica (abaixo) |
| Entrega de M e G, commit fora do código (o resto do `spec/`, a prova das guardas, hooks, `AGENTS.md`) | o contrato escrito e a prova que sustenta as outras guardas | nenhuma: mudar a prova é justamente o que ela não prova | 24 | fica |
| Especificação e Entrega de P subido pela procedência | a defesa contra injeção vinda de web ou MCP | nenhuma (a `procedencia` é o que sobe o gate) | 33 | fica |
| Entrega por ação (`entrega.push-main` …) | um ato externo ao repositório | nenhuma | 0 | fica |
| Reabertura de seção aprovada que mudou | que o texto aprovado é o que vale | nenhuma (a `aprovado-mudou` é o que reabre) | 1 | fica |
| Faixa `nunca` e `entrega.publicar` | o que nunca é do agente; publicar é ato público | — | 0 | fora da grelha: nunca se corta |

**O que a grelha mostra.** No `zeno/`, nenhuma das 84 decisões repetia uma guarda com sonda. Toda Entrega de M ou G
mexeu também no `spec/` (6) ou na prova das guardas (18). O grosso é outro: 33 dos 84 (39%) são P que só subiram pela
procedência, porque a marca de contaminação não foi limpa (o fim de sessão quase não rodou; a cura é o gasto que entra
sozinho, T103).

**O Filipe escolheu ficar só com a grelha (2026-11-04): a regra cortaria 0 dos 84, e nada mudou no código.** A regra
só cortaria a Entrega de M ou G cujo commit fica todo no código, num alvo que é o próprio `zeno/`, onde existe o
`promover`. Se um dia uma regra entrar, ela vai para o core como guarda com sonda, e não como uma linha a menos no
`faixas.yaml`: a tabela é o piso copiado para cada alvo e fundido por união.

## Apertar × afrouxar
`zeno ajustar` muda campos de controle. **Afrouxar** é toda mudança cujo efeito é: baixar a faixa efetiva; tirar item de
`acoes`, `checks` ou `depende_de`; voltar a `procedencia` a `confiavel`; trocar `executor` de pessoa para agente num nó
`nunca`; subir orçamento; cancelar nó fora da `autonoma`. Afrouxar exige pessoa e evento assinado. Todo o resto é apertar
e é livre. Várias atribuições numa chamada são aplicadas juntas (ex.: `faixa=nunca executor=filipe`).

## Procedência (D15)

- Classes **não confiáveis** de `origem`: `web:`, `issue:`, `doc:` (documento ingerido), `mcp:`, `sessao:contaminada`, e
  `no:<id>` de nó `nao-confiavel`. Qualquer uma ⇒ `procedencia: nao-confiavel`, calculada pela CLI.
- **Marca de contaminação mecânica** (o agente injetado é justamente quem não declara a origem): um hook `PostToolUse`
  gerado, matcher `WebFetch|WebSearch|mcp__.*`, chama `zeno guarda contaminou`, que grava o evento `contaminacao.marcada`
  com o `sessao_sha256` (T57). Enquanto a marca existir, todo `novo` acrescenta
  `sessao:contaminada` à origem do nó.
- A marca some quando o hook `SessionEnd` daquela sessão roda, ou quando uma pessoa a limpa (`zeno gate --descontaminar`,
  evento assinado `contaminacao.limpa`). O nó que foi marcado continua `nao-confiavel`.
- Contaminação herda: filho de nó `nao-confiavel` nasce `nao-confiavel`.
- Voltar um nó a `confiavel` = afrouxar (assinado).
- Toda mudança de faixa efetiva gera `faixa.alterada` com o motivo.

## Orçamento (D14)

**Dimensões:** `tokens`, `usd`, `tentativas`, e `prazo` (só aviso, nunca trava — não engessar).

**Consumo:** `tokens` e `usd` de um nó = os `gasto.registrado` dele + os dos descendentes. `tentativas` = gates reprovados
**do próprio nó** (não soma entre filhos). Tokens entram de duas fontes: `fonte: medido`, pelo hook `SessionEnd` que lê o
uso do transcript ([seguranca](seguranca.md#medição-mecânica)); `fonte: declarado`, por `zeno registrar gasto`. No Inc. 4 o
runner registra **antes** do efeito, como reserva.

**Herança:**
- nó sem `orcamento` consome do pai (vale o teto do ancestral mais próximo que declarou);
- nó com `orcamento` próprio: cada dimensão ≤ o saldo do pai na criação; a soma dos declarados dos filhos ≤ o declarado
  do pai (`validar`, regra `orcamento`);
- raiz sem `orcamento`: vale só o teto diário do alvo.

**Valores:** dimensão ausente ou `null` = sem teto; `0` = teto zero (qualquer gasto dispara).

**Disjuntor do nó:** a cada `avancar`, `gate`, `registrar gasto` e `novo`, a CLI compara consumo e teto no nó e em todos
os ancestrais. Se algum estoura:
- evento `disjuntor.disparou`;
- o nó vira `estado: pausado`; todo verbo que muda o nó ou um descendente sai com **4**;
- a CLI escreve uma `escalada` no fio, para o `dono`.
- Rearmar: `zeno gate <id> --orcamento tokens=+500000` (pessoa, assinado) ⇒ `orcamento.alterado`, `estado: ativo`.
  O orçamento declarado é o escopo do OK de custo.
- Soltar sem subir o teto (T98): `zeno gate <id> --despausar --motivo "…"` (pessoa, assinado) ⇒ `disjuntor.liberado`.
- **Só evento assinado de pessoa tira o nó da pausa (T98).** Baixar o orçamento (`ajustar orcamento=<menor>`) segue
  livre, mas não despausa. A pausa é regra da projeção: `fase.avancou`, `gate.aberto` e `gate.decidido` num nó pausado
  não mudam o nó, e o `validar` acusa (`pausado`).

**Teto diário do alvo** (`sistema.yaml → orcamento.teto_diario`): soma do dia (UTC) no ledger. Estourado, ele recusa
(saída 4) os verbos que gastam (`registrar gasto` e o registro do `SessionEnd` continuam gravando o fato, mas `novo` e
`avancar` saem com 4) **no alvo inteiro**, sem pausar nó, e se desfaz sozinho na virada do dia UTC. Padrão do Inc. 1:
`usd: 0`; `tokens` sem teto até o Filipe definir.
- Liberar o dia (T93): `zeno gate --teto usd=+X` (pessoa, assinado, sem id) soma X ao teto **só** do dia UTC em que foi
  assinado (`orcamento.alterado` com `no: null`). O `sistema.yaml` não muda, e no dia seguinte vale de novo o teto dele.
  É o OK de custo da C13: o teto 0 continua, e o OK passa a ter uma porta. Sem assinatura válida, a liberação não vale e
  o `validar` acusa (guarda `teto-assinado`). Um gasto que passa do teto liberado estoura de novo, com um novo
  `teto_diario.estourou`.
