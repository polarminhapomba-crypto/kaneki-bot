# Instruções para Adicionar os Comandos /svctt e /tmctt

Olá! Como o arquivo principal do seu bot (`index.js`) é protegido, a modificação direta para adicionar novos comandos é muito arriscada. Criei os novos comandos em arquivos separados e seguros. Para ativá-los, você precisará usar o comando `/addcustom` que já existe no seu bot.

Siga os passos abaixo.

## Passo 1: Entendendo os Novos Comandos

Eu criei dois arquivos na pasta `dados/src/funcs/utils/`:

1.  **`svctt.js`**: Contém a lógica para o comando `/svctt`, que salva um contato em um novo banco de dados (`dados/database/saved_contacts.json`).
    *   **Uso**: `/svctt <número> [nome]`
    *   **Exemplo**: `/svctt 5511999999999 Contato Exemplo`

2.  **`tmctt.js`**: Contém a lógica para o comando `/tmctt`, que envia uma mensagem para todos os contatos salvos.
    *   **Uso**: Responda a uma mensagem com `/tmctt`.

## Passo 2: Registrar os Comandos no Bot

Agora, vamos registrar esses comandos usando a função nativa do seu bot.

### Comando 1: /svctt

Envie a seguinte mensagem para o seu bot no WhatsApp (exatamente como está aqui):

```
/addcustom svctt

async (sock, message, text) => {
    const { handleSaveContact } = await import("../funcs/utils/svctt.js");
    await handleSaveContact(sock, message, text);
}
```

O bot deve responder confirmando que o comando `svctt` foi criado.

### Comando 2: /tmctt

Depois, envie esta outra mensagem para o seu bot:

```
/addcustom tmctt

async (sock, message, text) => {
    const { handleBroadcast } = await import("../funcs/utils/tmctt.js");
    await handleBroadcast(sock, message);
}
```

O bot deve confirmar a criação do comando `tmctt`.

## Passo 3: Testar os Comandos

1.  **Salve um contato**: Envie `/svctt 5511987654321 Meu Contato de Teste` para o bot.
2.  **Prepare a transmissão**: Envie qualquer mensagem para o bot (por exemplo, "Olá, esta é uma mensagem de teste").
3.  **Inicie a transmissão**: Responda a essa mensagem de teste com o comando `/tmctt`.

O bot deverá então encaminhar a sua mensagem de teste para o contato que você salvou.

## Observações Importantes

*   **Segurança**: Este método é seguro, pois não modifica os arquivos principais do bot.
*   **Persistência**: Os comandos customizados ficam salvos no arquivo `dados/dono/customCommands.json` e devem permanecer ativos mesmo que o bot reinicie.
*   **Transmissão**: O comando `/tmctt` envia as mensagens uma a uma com um pequeno atraso para diminuir o risco de bloqueio pelo WhatsApp. Use com moderação.

Se encontrar qualquer problema, pode me avisar!
