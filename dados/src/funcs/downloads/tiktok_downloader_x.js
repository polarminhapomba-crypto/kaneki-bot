// Adaptado do DownloaderX para nazuna - Versão sem yt-dlp
import axios from "axios";

const TIKWM_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'Cookie': 'current_language=pt-BR',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Encoding': 'gzip, deflate',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.tikwm.com/'
};

async function handleTikTokDownloader(sock, from, url, info) {
  if (!url.startsWith("http")) {
    await sock.sendMessage(from, { text: "❌ URL inválida" }, { quoted: info });
    return;
  }

  try {
    // Usar tikwm.com API
    const response = await axios.get('https://www.tikwm.com/api/', {
      params: { url },
      headers: TIKWM_HEADERS,
      timeout: 120000
    });

    if (!response.data?.data) {
      await sock.sendMessage(from, { text: "❌ Não foi possível obter dados do vídeo" }, { quoted: info });
      return;
    }

    const data = response.data.data;

    // Verificar se é slideshow (imagens) ou vídeo
    if (data.images && data.images.length > 0) {
      // É um slideshow - enviar imagens
      for (const imgUrl of data.images) {
        await sock.sendMessage(from, {
          image: { url: imgUrl },
          caption: data.title || ''
        }, { quoted: info });
      }
    } else if (data.play) {
      // É um vídeo - baixar e enviar
      const videoResponse = await axios.get(data.play, {
        responseType: 'arraybuffer',
        timeout: 120000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      await sock.sendMessage(from, {
        video: Buffer.from(videoResponse.data),
        mimetype: "video/mp4",
        caption: `📹 ${data.title || 'TikTok Video'}\n\n👤 @${data.author?.unique_id || 'unknown'}`,
      }, { quoted: info });
    } else {
      await sock.sendMessage(from, { text: "❌ Não foi possível encontrar o vídeo" }, { quoted: info });
    }

    // Enviar áudio se disponível
    if (data.music_info?.play) {
      try {
        const audioResponse = await axios.get(data.music_info.play, {
          responseType: 'arraybuffer',
          timeout: 60000
        });
        await sock.sendMessage(from, {
          audio: Buffer.from(audioResponse.data),
          mimetype: 'audio/mp4'
        }, { quoted: info });
      } catch (e) {
        console.log('Não foi possível enviar o áudio:', e.message);
      }
    }

  } catch (err) {
    console.error("❌ Erro ao baixar TikTok:", err.message);
    await sock.sendMessage(from, {
      text: "❌ Falha ao baixar vídeo do TikTok. Tente novamente com outro link.",
    }, { quoted: info });
  }
}

export { handleTikTokDownloader };
