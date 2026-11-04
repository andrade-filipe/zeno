# Cartão: Especificação
**Pergunta:** o que é estar pronto?
**Artefato:** `- pronto:` com um critério verificável. M/G: `- restricoes:` e `- riscos:`; G: os filhos ou o plano de corte.
**Gate típico:** check; humano (revisor) nas faixas aprovação e nunca.
**Cuidado:** a spec diz o quê, não o como. Dependências (`depende_de`) precisam ter passado da Entrega.
**Gate humano:** só abre com o cartão de decisão (T75): `--cartao-muda --cartao-porque --cartao-risco --cartao-desfazer --cartao-reprovar --cartao-conferir`, em linguagem simples para quem aprova, sem "ok" nem "ver acima"; conferir com 1 a 3 itens. D40: frase curta (até 160 caracteres por campo, 100 por item do conferir) e o risco começa pelo nível, `alto:`, `baixo:` ou `nenhum:`.
