// Adaptado do DownloaderX para nazuna - Versão sem yt-dlp
import axios from 'axios';

const CONFIG = {
  TIMEOUT: 60000,
  DOWNLOAD_TIMEOUT: 180000,
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function handleYouTubeDownloader(sock, from, url, info) {
  if (!url.startsWith('http')) {
    await sock.sendMessage(from, { text: '❌ URL inválida' }, { quoted: info });
    return;
  }

  try {
    // Usar API nayan-video-downloader para YouTube
    const response = await axios.get('https://nayan-video-downloader.vercel.app/ytdown', {
      params: { url },
      timeout: CONFIG.TIMEOUT,
      headers: { 'User-Agent': CONFIG.USER_AGENT }
    });

    const raw = response.data;
    const body = (raw && typeof raw.status === 'number' && raw.data) ? raw.data : raw;

    if (!body || body.status === false) {
      await sock.sendMessage(from, { text: '❌ Não foi possível processar o vídeo' }, { quoted: info });
      return;
    }

    const media = (body.data && (body.data.title || body.data.video || body.data.audio)) ? body.data : body;

    // Tentar baixar vídeo
    let downloadUrl = media.video_hd || media.video;
    let isVideo = true;

    // Se não tiver vídeo, tentar áudio
    if (!downloadUrl && media.audio) {
      downloadUrl = media.audio;
      isVideo = false;
    }

    if (!downloadUrl) {
      await sock.sendMessage(from, { text: '❌ URL de download não disponível' }, { quoted: info });
      return;
    }

    // Baixar o arquivo
    const fileResponse = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: CONFIG.DOWNLOAD_TIMEOUT,
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Referer': 'https://nayan-video-downloader.vercel.app/'
      }
    });

    const buffer = Buffer.from(fileResponse.data);
    const title = media.title || 'YouTube Video';

    if (isVideo) {
      await sock.sendMessage(from, {
        video: buffer,
        mimetype: 'video/mp4',
        caption: `📹 ${title}`
      }, { quoted: info });
    } else {
      await sock.sendMessage(from, {
        audio: buffer,
        mimetype: 'audio/mpeg'
      }, { quoted: info });
    }

  } catch (err) {
    console.error('❌ Erro ao baixar YouTube:', err.message);
    await sock.sendMessage(from, { text: '❌ Falha ao baixar do YouTube. Tente novamente.' }, { quoted: info });
  }
}

export { handleYouTubeDownloader };
