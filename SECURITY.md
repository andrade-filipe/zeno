# Segurança

O Zeno é a camada que governa o que agentes podem fazer num repositório (guardas, gates, ledger assinado). Uma falha
aqui pode deixar um agente passar por uma regra. Por isso, relate com cuidado.

## Versões com suporte

| Versão | Suporte |
|---|---|
| 0.1.x | sim |

## Plataformas

- **Linux** e **WSL2**: com suporte.
- **macOS**: sem suporte na v0.1. O `zeno sessao` depende do bubblewrap (`bwrap`), que não existe no macOS, e não há
  como testar lá.

## Como relatar uma vulnerabilidade

Não abra issue pública. Use o relato privado de vulnerabilidade do GitHub, na aba **Security** deste repositório
(**Report a vulnerability**). Inclua:

- a versão (`zeno versao`) e a plataforma;
- o que a guarda deveria negar e o que passou;
- os passos mínimos para reproduzir, de preferência num alvo de teste num diretório temporário.

A resposta inicial vem em até 7 dias. A correção sai numa versão nova pelo portão de publicação, com o relato
creditado, se você quiser.

## Fora do escopo

- Um agente com acesso de root ou ao usuário da pessoa fora do sandbox: o Zeno não defende contra o dono da máquina.
- A cópia que guarda instalada na casa (`~/.local/share/zeno`): ela é gravável pelo uid da pessoa. A cópia do root
  (`/opt/zeno`) é a que fecha esse caminho.
