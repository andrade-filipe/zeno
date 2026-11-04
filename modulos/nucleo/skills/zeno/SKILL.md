---
name: zeno
description: Como trabalhar num alvo governado pelo Zeno — o loop de 7 fases, a CLI zeno, gates, mensagens e a via expressa. Use ao começar, avançar, entregar ou registrar trabalho num repo com .agents/sistema.yaml.
---
# Zeno: como trabalhar aqui

1. **Ache ou crie o nó.** `zeno status` mostra o grafo. Trabalho novo: `zeno novo "<título>" --tamanho P|M|G [--pai <id>]`.
   P é pequeno (cabe numa sessão, poucas linhas); M e G pedem aprovação humana na Especificação e na Entrega.
2. **Monte o contexto da fase.** `zeno contexto <id>` traz o nó, a spec do pai, o pedido, o cartão da fase, as refs e lições.
3. **Escreva o artefato da fase** no corpo do nó (`- chave: valor` na seção da fase) ou passe a chave no `avancar`.
4. **Avance.** `zeno avancar <id>` roda o gate. Códigos: 0 avançou · 1 falta algo ou check reprovado · 3 espera pessoa · 4 orçamento.
5. **Converse pelo fio.** `zeno msg <id> <pedido|pergunta|resposta|decisao|entrega|escalada|aviso> --para <quem> --<campo> "…"`.
   Mensagem autossuficiente: quem lê sem contexto entende.
6. **Nunca contorne** uma negação, um gate ou o disjuntor. Escale.

Chaves de cada fase: intencao `porque` (M/G: `para`, `fora`) · especificacao `pronto` (M/G: `restricoes`, `riscos`) · execucao `feito` ·
verificacao `evidencia` (M/G: `pronto-confere`; G: `sessao: nova`) · entrega `ref`, `desfazer` · observacao `observado` · aprendizado `atrito`.
