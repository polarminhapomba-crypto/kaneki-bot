// Adaptado do DownloaderX para kaneki - Versão sem yt-dlp
import axios from 'axios';

async function handleInstagramDownloader(sock, from, url, info) {
  if (!url.startsWith('http')) {
    await sock.sendMessage(from, { text: '❌ URL inválida' }, { quoted: info });
    return;
  }

  try {
    // Usar API nayan-video-downloader
    const response = await axios.get(`https://nayan-video-downloader.vercel.app/ndown?url=${encodeURIComponent(url)}`, {
      timeout: 120000
    });

    if (!response.data?.data?.length) {
      await sock.sendMessage(from, { text: '❌ Postagem não encontrada' }, { quoted: info });
      return;
    }

    const uniqueUrls = new Set();

    // Processar cada item de mídia
    for (const item of response.data.data) {
      if (uniqueUrls.has(item.url)) continue;
      uniqueUrls.add(item.url);

      try {
        // Verificar tipo de mídia via HEAD request
        const headResponse = await axios.head(item.url, { timeout: 30000 });
        const contentType = headResponse.headers['content-type'] || '';
        
        // Baixar o conteúdo
        const mediaResponse = await axios.get(item.url, {
          responseType: 'arraybuffer',
          timeout: 120000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const buffer = Buffer.from(mediaResponse.data);
        const isImage = contentType.startsWith('image/');

        if (isImage) {
          await sock.sendMessage(from, {
            image: buffer,
            caption: '📸 Instagram Image'
          }, { quoted: info });
        } else {
          await sock.sendMessage(from, {
            video: buffer,
            mimetype: 'video/mp4',
            caption: '📹 Instagram Video'
          }, { quoted: info });
        }
      } catch (downloadError) {
        console.error('Erro ao baixar mídia do Instagram:', downloadError.message);
      }
    }

  } catch (err) {
    console.error('❌ Erro ao baixar Instagram:', err.message);
    await sock.sendMessage(from, { text: '❌ Falha ao baixar do Instagram. Tente novamente.' }, { quoted: info });
  }
}

export { handleInstagramDownloader };
