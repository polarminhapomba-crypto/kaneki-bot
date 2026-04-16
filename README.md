# Kaneki Bot

## Instalação

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

## Solução de Problemas

### Erro de Token do GitHub no Upload
Se você encontrar erros relacionados ao token do GitHub ao tentar fazer upload de arquivos, certifique-se de que o token está configurado corretamente.
O bot espera que o token esteja definido no arquivo `dados/src/funcs/utils/upload.js` ou via variáveis de ambiente (se configurado para ler de `process.env`).

### Comando /manus não responde
O comando `/manus` requer uma conexão ativa com a API do Manus. Verifique se a URL da API em `dados/src/funcs/private/manusBridge.js` está correta e acessível.
