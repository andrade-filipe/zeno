# zeno/ — o que executa

O Zeno: o sistema de processos que governa qualquer trabalho feito com agentes (loop de 7 fases, nó recursivo num grafo,
CLI `zeno` como única porta de escrita, faixas, gates, orçamento, ledger). Inc. 1 (o esqueleto): core, CLI, módulo `nucleo`.

- Spec técnica: [`spec/README.md`](spec/README.md) · decisões técnicas: [`spec/decisoes-tecnicas.md`](spec/decisoes-tecnicas.md).
- Stack: Node ESM **sem dependências**. As decisões de desenho (D…) ficam fora deste repositório.
- Lê o `conhecimento/` só como dado (arquivos de nó), nunca como código.
- Rodar: `node ./cli.mjs ajuda` (ou `zeno ajuda` com o shim `bin/zeno` no PATH).
- Testes: `node --test test/*.test.mjs test/probes/*.test.mjs` · censo das guardas: `node test/censo.mjs` ([`guardas.json`](guardas.json)).
- Só o `cli.mjs` toca o processo; o core recebe `ctx` (T16). Nunca apagar: o que sai vai para `_lixo/`.

<!-- zeno:inicio nucleo -->
<!-- GERADO pelo zeno sync; não edite. Fonte: zeno/modulos/nucleo@0.1.0 -->
## Zeno (módulo nucleo)
**O 1º ato num alvo, antes da 1ª edição, é abrir o nó:** para trabalho pequeno (P), `zeno novo "…" --expressa --porque "…"`; para um nó que já existe, `zeno contexto <id>`. Edição ou commit sem nó tocado faz o fim da conversa e o commit pedirem `zeno registrar "…" --retro …`.
Este alvo é governado pelo Zeno. O trabalho vive em `.agents/trabalho/` como nós; o estado vive em `.agents/ledger.jsonl`.
- Todo trabalho é um nó que passa pelas 7 fases: Intenção → Especificação → Execução → Verificação → Entrega → Observação → Aprendizado.
- **Toda mudança de estado passa pela CLI `zeno`** (`novo`, `avancar`, `msg`, `registrar` …). O corpo do nó (os artefatos) pode ser editado; o frontmatter é vista do ledger.
- Antes de começar uma fase de um nó grande: `zeno contexto <id>`.
- Nó pequeno (P): `zeno novo "…" --expressa --porque "…"`, faça o trabalho, `zeno avancar <id> --ate fim --pronto … --feito … --evidencia … --ref … --desfazer …`.
- Gate humano não é do agente: quando `zeno avancar` sair com 3, avise a pessoa e siga com outra coisa. Aprovação no chat não conta.
- Se algo for negado (código 1, 3 ou 4, ou um hook), **não contorne**: pare e escale (`zeno msg <id> escalada …`).
- Trabalho feito fora do Zeno: `zeno registrar "…" --retro …`.
<!-- zeno:fim nucleo -->
