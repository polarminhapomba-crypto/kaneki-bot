# Integração do comando `/manus`

Este projeto recebeu uma interceptação dedicada para o comando `/manus` no fluxo principal do bot.

## O que foi adicionado

O bot agora reconhece mensagens no formato abaixo antes de encaminhá-las ao dispatcher principal:

```text
/manus <pedido>
```

Também foi adicionado o item correspondente no menu de IA.

## Ordem de execução

Quando o usuário envia `/manus`, o bot tenta processar nesta ordem:

1. **Ponte OpenManus** via `OPENMANUS_BRIDGE_URL`
2. **Fallback compatível com OpenAI** via `OPENAI_API_KEY`

## Variáveis de ambiente recomendadas no Railway

| Variável | Obrigatória | Finalidade |
|---|---:|---|
| `OPENMANUS_BRIDGE_URL` | não | URL HTTP da sua ponte/reverso para OpenManus |
| `OPENMANUS_API_KEY` | não | Token Bearer para autenticar na ponte OpenManus |
| `OPENAI_API_KEY` | não
a | Chave do fallback compatível com OpenAI |
| `OPENAI_BASE_URL` | não | Base URL OpenAI-compatible, se não usar a oficial |
| `OPENMANUS_FALLBACK_MODEL` | não | Modelo padrão do fallback textual |
| `MANUS_TIMEOUT_MS` | não | Timeout do comando, padrão `120000` |

> Pelo menos **uma** rota precisa existir: ou a ponte OpenManus, ou o fallback compatível com OpenAI.

## Exemplos de uso

```text
/manus resuma este texto em 5 linhas
/manus crie um plano de vendas para minha loja
/manus explique este erro de JavaScript
```

## Observações importantes

1. Esta integração já deixa o comando preparado dentro do bot, mas **recursos avançados dependem do backend que você ligar** por variáveis de ambiente.
2. Se você quiser comportamento realmente próximo do OpenManus oficial, o ideal é expor uma **ponte HTTP própria** para o runtime Python dele e apontar `OPENMANUS_BRIDGE_URL` para essa ponte.
3. Se nenhuma credencial estiver configurada, o bot responde com instruções de configuração em vez de travar.
