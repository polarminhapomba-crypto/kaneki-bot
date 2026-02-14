// Adaptado do DownloaderX para kaneki - Versão com conversão FFmpeg para compatibilidade total
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

const CONFIG = {
  TIMEOUT: 60000,
  DOWNLOAD_TIMEOUT: 180000,
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  TEMP_DIR: './dados/temp'
};

// Garantir que o diretório temporário exista
if (!fs.existsSync(CONFIG.TEMP_DIR)) {
  fs.mkdirSync(CONFIG.TEMP_DIR, { recursive: true });
}

async function handleYouTubeDownloader(sock, from, url, info) {
  if (!url.startsWith('http')) {
    await sock.sendMessage(from, { text: '❌ URL inválida' }, { quoted: info });
    return;
  }

  const tempInput = path.join(CONFIG.TEMP_DIR, `input_${Date.now()}.mp4`);
  const tempOutput = path.join(CONFIG.TEMP_DIR, `output_${Date.now()}.mp4`);

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
      await sock.sendMessage(from, { text: '❌ Não foi possível processar o vídeo. Tente novamente mais tarde.' }, { quoted: info });
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
      await sock.sendMessage(from, { text: '❌ URL de download não disponível para este vídeo.' }, { quoted: info });
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
      // Salvar arquivo temporário para conversão
      fs.writeFileSync(tempInput, buffer);

      // Converter para H.264/AAC usando FFmpeg para garantir compatibilidade com WhatsApp
      // -c:v libx264 (video codec)
      // -profile:v baseline -level 3.0 (máxima compatibilidade)
      // -pix_fmt yuv420p (formato de pixel padrão)
      // -c:a aac (audio codec)
      // -movflags +faststart (permite reprodução antes do download completo)
      try {
        await execPromise(`ffmpeg -i ${tempInput} -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart -y ${tempOutput}`);
        
        const finalBuffer = fs.readFileSync(tempOutput);
        
        await sock.sendMessage(from, {
          video: finalBuffer,
          mimetype: 'video/mp4',
          fileName: `${title}.mp4`,
          caption: `📹 *${title}*\n\n✅ Vídeo processado para compatibilidade total!`
        }, { quoted: info });
      } catch (ffmpegErr) {
        console.error('Erro FFmpeg:', ffmpegErr);
        // Fallback: enviar o buffer original se a conversão falhar
        await sock.sendMessage(from, {
          video: buffer,
          mimetype: 'video/mp4',
          fileName: `${title}.mp4`,
          caption: `📹 *${title}*\n\n⚠️ Enviado sem conversão (compatibilidade reduzida).`
        }, { quoted: info });
      }
    } else {
      await sock.sendMessage(from, {
        audio: buffer,
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`
      }, { quoted: info });
    }

  } catch (err) {
    console.error('❌ Erro ao baixar YouTube:', err.message);
    await sock.sendMessage(from, { 
      text: '❌ Falha ao processar o vídeo do YouTube. Tente novamente.' 
    }, { quoted: info });
  } finally {
    // Limpar arquivos temporários
    if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
  }
}

export { handleYouTubeDownloader };
