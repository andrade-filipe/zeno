**testes** · os comandos dos `checks:` do `.agents/sistema.yaml` são os testes deste alvo; rode-os antes de avançar.
O `zeno avancar` roda os checks do nó no gate; rodar antes poupa uma recusa.
Na Verificação, a `- evidencia:` leva as contagens (quantos passam, falham, pulam), não "ok".
Nunca: apagar, pular ou afrouxar teste para passar; teste que falha é dado, e o caminho é corrigir ou escalar.
Teste novo para o que a tarefa muda; fixture em diretório temporário, nunca no repo real.
