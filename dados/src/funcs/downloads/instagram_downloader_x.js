import axios from 'axios';

const APIS = [
  'https://nayan-video-downloader.vercel.app/ndown',
  'https://api.vreden.my.id/api/igdl'
];

async function handleInstagramDownloader(sock, from, url, info) {
  if (!url.startsWith('http')) {
    await sock.sendMessage(from, { text: '❌ URL inválida' }, { quoted: info });
    return;
  }

  let success = false;
  let errorMsg = '❌ Postagem não encontrada ou perfil privado.';

  for (const apiBase of APIS) {
    try {
      const apiUrl = `${apiBase}?url=${encodeURIComponent(url)}`;
      const response = await axios.get(apiUrl, { timeout: 30000 });
      
      // Ajuste para diferentes formatos de resposta das APIs
      let data = response.data?.data || response.data?.result;
      if (!Array.isArray(data) && data?.url) data = [data];
      if (!Array.isArray(data)) continue;

      if (data.length > 0) {
        const uniqueUrls = new Set();
        for (const item of data) {
          const mediaUrl = item.url || item.downloadUrl || (typeof item === 'string' ? item : null);
          if (!mediaUrl || uniqueUrls.has(mediaUrl)) continue;
          uniqueUrls.add(mediaUrl);

          try {
            const mediaResponse = await axios.get(mediaUrl, {
              responseType: 'arraybuffer',
              timeout: 60000,
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });

            const buffer = Buffer.from(mediaResponse.data);
            const contentType = mediaResponse.headers['content-type'] || '';
            
            if (contentType.startsWith('image/')) {
              await sock.sendMessage(from, { image: buffer, caption: '📸 Instagram' }, { quoted: info });
            } else {
              await sock.sendMessage(from, { video: buffer, mimetype: 'video/mp4', caption: '📹 Instagram' }, { quoted: info });
            }
            success = true;
          } catch (e) {
            console.error('Erro ao baixar mídia individual:', e.message);
          }
        }
        if (success) break;
      }
    } catch (err) {
      console.error(`Erro na API ${apiBase}:`, err.message);
    }
  }

  if (!success) {
    await sock.sendMessage(from, { text: errorMsg }, { quoted: info });
  }
}

export { handleInstagramDownloader };
