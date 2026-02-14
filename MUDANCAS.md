# Mudanças Realizadas - Integração DownloaderX

## Resumo
Foram transferidos os comandos de download do TikTok, Instagram e YouTube do projeto DownloaderX para o projeto kaneki, substituindo as cases correspondentes.

## Arquivos Novos Criados

### 1. `/dados/src/funcs/downloads/tiktok_downloader_x.js`
- Adaptação do `tiktok.js` do DownloaderX
- Usa `yt-dlp-exec` para fazer download de vídeos do TikTok
- Função: `handleTikTokDownloader(sock, from, url)`
- Suporta resolução de URLs encurtadas do TikTok

### 2. `/dados/src/funcs/downloads/instagram_downloader_x.js`
- Adaptação do `instagram.js` do DownloaderX
- Usa `yt-dlp-exec` para fazer download de vídeos do Instagram
- Função: `handleInstagramDownloader(sock, from, url)`

### 3. `/dados/src/funcs/downloads/youtube_downloader_x.js`
- Adaptação do `youtube.js` do DownloaderX
- Usa `yt-dlp-exec` para fazer download de vídeos do YouTube
- Função: `handleYouTubeDownloader(sock, from, url)`

## Mudanças no index.js

### Case 'tiktok' (linhas 19043-19068)
**Antes**: Usava módulo `tiktok.dl()` e `tiktok.search()`
**Depois**: Usa `handleTikTokDownloader()` do DownloaderX com yt-dlp

**Comandos suportados**:
- tiktok
- tiktokaudio
- tiktokvideo
- tiktoks
- tiktoksearch
- ttk
- tkk

### Case 'instagram' (linhas 19147-19170)
**Antes**: Usava módulo `igdl.dl()`
**Depois**: Usa `handleInstagramDownloader()` do DownloaderX com yt-dlp

**Comandos suportados**:
- instagram
- igdl
- ig
- instavideo
- igstory

### Case 'play' (linhas 18493-18522)
**Antes**: Usava módulo `youtube.search()` e `youtube.mp3()`
**Depois**: Usa `handleYouTubeDownloader()` do DownloaderX com yt-dlp

**Comandos suportados**:
- play
- ytmp3

## Dependências Necessárias

Certifique-se de que as seguintes dependências estão instaladas no projeto:
- `yt-dlp-exec` - Para fazer download de vídeos
- `axios` - Para requisições HTTP
- `whaileys` - Para integração com WhatsApp

## Como Usar

Após integrar essas mudanças, os comandos funcionarão da seguinte forma:

```
// TikTok
!tiktok https://www.tiktok.com/...

// Instagram
!instagram https://www.instagram.com/reel/...

// YouTube
!play https://www.youtube.com/watch?v=...
```

## Notas Importantes

1. Os novos handlers usam `yt-dlp` que é mais robusto e suporta mais plataformas
2. Os arquivos temporários são criados e deletados automaticamente após o download
3. As mensagens de erro foram mantidas em português para melhor UX
4. O código mantém a estrutura assíncrona original do kaneki

## Próximos Passos

1. Instale as dependências se necessário: `npm install yt-dlp-exec`
2. Teste os comandos com URLs válidas
3. Verifique os logs para possíveis erros
4. Ajuste as mensagens conforme necessário


---

# Comando /add - Adicionar Participantes ao Grupo

## Data: 14 de Fevereiro de 2026

## Resumo
Implementado novo comando `/add` que permite adicionar participantes ao grupo usando apenas o número de telefone.

## Funcionalidade

### Comando: `/add` ou `/adicionar`

**Localização no código**: `dados/src/index.js` (linhas 24945-24986)

**Descrição**: Adiciona um participante ao grupo usando o número de telefone fornecido.

**Sintaxe**:
```
/add 5511999999999
/adicionar 5511999999999
```

**Requisitos**:
- Comando só funciona em grupos
- Usuário que executa o comando deve ser administrador
- Bot deve ser administrador do grupo

**Validações implementadas**:
- Verifica se é um grupo
- Verifica permissões de administrador do usuário
- Verifica se o bot é administrador
- Valida se o número foi fornecido
- Remove caracteres especiais automaticamente
- Valida se o número tem pelo menos 10 dígitos
- Formata automaticamente para o padrão WhatsApp

**Integração com sistema X9**:
- Envia notificação automática quando X9 está ativo
- Menciona o usuário adicionado e quem adicionou

**Tratamento de erros**:
- Erro 403: Fornece mensagens detalhadas sobre possíveis motivos
  - Número incorreto
  - Usuário saiu recentemente do grupo
  - Usuário bloqueou convites de grupos
  - Configurações de privacidade restritas
- Erros genéricos: Mensagem de erro amigável

## Exemplo de Uso

```
/add 5511999999999
```

**Resposta de sucesso**:
```
✅ Usuário @5511999999999 adicionado com sucesso!
```

**Resposta de erro (número inválido)**:
```
❌ Número inválido! Digite um número completo com DDD.

Exemplo: /add 5511999999999
```

## Commit
- Hash: `fae7d2b0`
- Mensagem: "feat: adicionar comando /add para adicionar participantes ao grupo por número de telefone"
- Arquivos alterados: `dados/src/index.js` (+42 linhas)


---

# Correção Comando /play - Erro de Reprodução de Vídeo

## Data: 14 de Fevereiro de 2026

## Resumo
Corrigido erro onde os vídeos baixados do YouTube (especialmente Shorts) não eram reproduzíveis no WhatsApp, exibindo a mensagem "Este vídeo não está disponível porque há algo errado com o arquivo de vídeo".

## Mudanças Realizadas

### Arquivo: `dados/src/funcs/downloads/youtube_downloader_x.js`

1. **Adição de Metadados de Arquivo**: Adicionado o parâmetro `fileName` ao enviar a mensagem de vídeo. Isso ajuda o WhatsApp a identificar corretamente o container e o codec do arquivo MP4, resolvendo problemas de reprodução.
2. **Priorização de Qualidade**: Reforçada a prioridade para `video_hd` (720p) quando disponível, que possui melhor compatibilidade de encoding.
3. **Melhoria nas Mensagens**: Atualizadas as legendas e mensagens de erro para serem mais informativas para o usuário.

## Commit
- Hash: `3da137a6`
- Mensagem: "fix: corrigir erro de reprodução de vídeo do YouTube no WhatsApp adicionando metadados de arquivo"


---

# Solução Definitiva Comando /play - Conversão FFmpeg (H.264)

## Data: 14 de Fevereiro de 2026

## Resumo
Implementada conversão obrigatória para o codec H.264 usando FFmpeg para todos os vídeos baixados do YouTube. Esta é a solução definitiva para o erro de "vídeo indisponível" no WhatsApp, causado por codecs incompatíveis (como AV1 ou VP9) fornecidos pelo YouTube.

## Mudanças Técnicas

### Arquivo: `dados/src/funcs/downloads/youtube_downloader_x.js`

1. **Processamento via FFmpeg**: O vídeo agora passa por um processo de transcodificação antes de ser enviado:
   - **Codec de Vídeo**: `libx264` (Perfil Baseline 3.0 para compatibilidade máxima com celulares antigos e novos).
   - **Formato de Pixel**: `yuv420p` (Padrão exigido pelo WhatsApp).
   - **Codec de Áudio**: `aac` (128k).
   - **Faststart**: Ativada a flag `+faststart` para permitir que o vídeo comece a ser reproduzido enquanto ainda está sendo baixado no WhatsApp.
2. **Gerenciamento de Arquivos Temporários**: Implementada lógica de criação e limpeza automática de arquivos temporários no diretório `./dados/temp`.
3. **Fallback de Segurança**: Caso a conversão falhe por qualquer motivo técnico, o sistema tenta enviar o arquivo original para não deixar o usuário sem resposta.

## Commit
- Hash: `3a2259c9`
- Mensagem: "fix: conversão de vídeo via FFmpeg para codec H.264 (correção definitiva para reprodução no WhatsApp)"


---

# Ajuste Fino Comando /play - Encoding de Compatibilidade Máxima

## Data: 14 de Fevereiro de 2026

## Resumo
Refinamento da conversão de vídeo para resolver persistência de erro em alguns dispositivos WhatsApp.

## Mudanças Técnicas

### Arquivo: `dados/src/funcs/downloads/youtube_downloader_x.js`

1. **Ajuste de Perfil H.264**: Alterado de `baseline` para `main` com nível `3.1`. Este é o "sweet spot" de compatibilidade para o player do WhatsApp.
2. **Escalonamento de Vídeo**: Adicionado filtro de escala `scale='min(1280,iw)':-2`. Isso garante que:
   - O vídeo não ultrapasse 720p (evitando rejeição por resolução excessiva).
   - As dimensões sejam sempre pares (requisito técnico para evitar erros de renderização no Android).
3. **Fallback para Documento**: Caso o processamento de vídeo ainda encontre problemas no dispositivo do usuário, o código agora inclui uma lógica de fallback que envia o arquivo original como **documento**, garantindo que o usuário sempre receba o conteúdo.

## Commit
- Hash: `73a407c0`
- Mensagem: "fix: ajuste de encoding FFmpeg (Profile Main 3.1) e escala para compatibilidade total com WhatsApp"
