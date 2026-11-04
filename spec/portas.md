# Portas: o núcleo agnóstico e a porta do Claude Code (D39)

O Zeno é agnóstico à ferramenta de LLM (D39). O que funciona com qualquer ferramenta, ou com uma pessoa no shell, é o
**núcleo**. O que só vale dentro de uma ferramenta é uma **porta** dessa ferramenta. Hoje existe uma porta, a do Claude
Code. Inventário lido do código em 2026-11-03.

## Núcleo agnóstico
- a CLI `zeno` com todos os verbos ([cli](cli.md)); o ledger append-only e a projeção ([ledger](ledger.md)); nó, fio,
  fases, faixas e gates ([no](no.md), [fases](fases.md), [controle](controle.md));
- a assinatura Ed25519 da pessoa (TTY + passphrase), o `promover` e a cópia fixada ([seguranca](seguranca.md));
- o `validar` e os githooks (camada 4); o censo e o `guardas.json`;
- o `zeno contexto`;
- o tokenizador de shell (`core/shell.mjs`): é agnóstico, mas hoje só recebe o formato do hook do Claude Code;
- o bloco no `AGENTS.md`: várias ferramentas leem esse arquivo. Na adoção, o bloco sai dele e passa a ir pela porta
  (T83).

## Porta do Claude Code
| Peça | Onde | O que depende do Claude Code |
|---|---|---|
| camada 1: deny | `core/verbos/instalar.mjs`, `core/protegidos.mjs` | regras `Edit(/<rel>)` no `.claude/settings.json` ou no `settings.local.json` |
| camada 2: trava antes da ação | `core/verbos/guarda.mjs` (`pre-tool`) | o JSON do hook `PreToolUse` (`tool_name`, `tool_input.command\|file_path`, `cwd`, `session_id`) e a resposta `hookSpecificOutput.permissionDecision: deny` |
| contaminação | `guarda contaminou` | `PostToolUse` em `WebFetch\|WebSearch\|mcp__.*`, pelos nomes de ferramenta do Claude Code |
| medição | `guarda fim-sessao` | `SessionEnd` com o `transcript_path` no formato do Claude Code (probe `transcript-formato`) |
| deixa do hábito (T113) | `guarda parar` | `Stop` com `stop_hook_active`, `transcript_path` e `cwd`, e a resposta `{"decision":"block","reason":…}` (probe `stop-formato`); o formato não é contrato público: se mudar, a deixa some calada até a sonda acusar. A deixa do commit (`validar --staged`) não depende de porta |
| gerados | `instalar.mjs` | o `CLAUDE.md` com `@AGENTS.md` e a skill `.claude/skills/zeno-*` (fora da adoção) |
| ator | `core/sessao.mjs` (`resolverAtor`, `exigirPessoa`), `core/shell.mjs` | `CLAUDECODE` no env vira `ia:claude`; as guardas `ator-falso` e de shell o usam |

## O que sobra sob outra ferramenta, sem porta
Só as camadas 3 (as regras da CLI) e 4 (os githooks). A assinatura segue provando quem é pessoa.

**Achado:** um agente fora do Claude Code (sem `CLAUDECODE`) cujo comando roda num pty, com o `user.email` do git do
Filipe, é resolvido **como a pessoa** (`resolverAtor`). Ele não consegue assinar, porque falta a passphrase. Mas os nós
e os eventos não assinados que ele cria saem atribuídos ao Filipe. O conserto é o marcador de identidade do agente
(T82) ou um `ZENO_ATOR` posto pela porta.

## O contrato mínimo de uma porta (T83)
1. **Entregar o bloco** do Zeno ao agente no início da sessão, e só onde os itens 2 e 3 estão de pé.
2. **Uma trava antes da ação.** Ela chama `zeno guarda pre-tool` com um JSON normalizado e **falha fechado**: um erro
   ou a ausência do zeno negam a ação.
3. **O sinal de ator.** O agente não passa por pessoa.
4. **Fora do git do time e por máquina.** A porta é instalada pelo `sync`, só onde ele rodou.
5. **Uma sonda** que prova os itens 1–3 na própria ferramenta e fica vermelha numa cópia mutada.

Opcionais: a contaminação e a medição. Sem a medição, o gasto fica com `fonte: declarado`.
