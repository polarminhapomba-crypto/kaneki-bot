# Toji Bot 🗡️💰

## O Assassino de Feiticeiros no seu WhatsApp

Este é o Toji Bot, um bot de WhatsApp com a personalidade inconfundível de Toji Fushiguro. Direto, sarcástico e focado no que realmente importa: resultados. Ele não está aqui para papo furado, a menos que você tenha algo interessante (e lucrativo) a oferecer.

### O que esperar do Toji Bot:

- **Personalidade Toji**: Respostas afiadas, sarcasmo e a visão de mundo de um mercenário que não se importa com formalidades.
- **Modo Misto (Padrão)**: O Toji Bot vem de fábrica com um modo "misto" ativado. Isso significa que ele não só responde com a personalidade do Toji, mas também **executa comandos em linguagem natural** (sem precisar de prefixo!). Peça e ele fará, mas talvez com um resmungo ou uma pergunta sobre pagamento.
- **Assistente PV Ativado**: No privado, o Toji Bot já está pronto para interagir no modo misto.

## Instalação

Para ter o Toji Bot rodando no seu servidor, siga os passos abaixo:

Clone o repositório:
```bash
git clone https://github.com/polarminhapomba-crypto/kaneki-bot.git
```

Entre no diretório do projeto:
```bash
cd kaneki-bot
```

Configure e instale as dependências:
```bash
npm run config
npm run config:install
```

## Iniciar o Bot

Para ligar o bot, execute:
```bash
npm start
```

## Comandos do Assistente

O Toji Bot opera principalmente no modo misto, interpretando suas mensagens. No entanto, você pode ajustar o comportamento dele com os seguintes comandos:

- `/assistentepv` — Ativa/desativa o assistente no PV
- `/assistentepv misto` — Define a personalidade Misto (Toji + comandos)
- `/assistentepv toji` — Define a personalidade Toji pura
- `/assistentepv humana` — Define a personalidade humana
- `/assistentepv pro` — Define o modo de execução de comandos (sem respostas)
- `/assistentepv manus` — Integração com Manus para tarefas complexas
- `/assistente` — Configura o assistente no grupo

## Solução de Problemas

Se encontrar algum problema, verifique os logs do console ou o arquivo `MUDANCAS.md` para atualizações recentes.
