// Adaptado do DownloaderX para kaneki - Versão com encoding de compatibilidade máxima para WhatsApp
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

  const timestamp = Date.now();
  const tempInput = path.join(CONFIG.TEMP_DIR, `in_${timestamp}.mp4`);
  const tempOutput = path.join(CONFIG.TEMP_DIR, `out_${timestamp}.mp4`);

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

      // Parâmetros de conversão para COMPATIBILIDADE MÁXIMA com WhatsApp:
      // -c:v libx264: Codec H.264
      // -profile:v main: Perfil Main (mais compatível que High, melhor que Baseline para qualidade/tamanho)
      // -level 3.1: Nível de compatibilidade padrão para dispositivos móveis
      // -pix_fmt yuv420p: Formato de pixel exigido pelo WhatsApp
      // -c:a aac: Codec de áudio padrão
      // -b:a 128k: Bitrate de áudio estável
      // -movflags +faststart: Move o índice para o início (permite reprodução instantânea)
      // -vf "scale='min(1280,iw)':-2": Garante que a largura não passe de 1280 e a altura seja par (requisito de muitos codecs)
      try {
        await execPromise(`ffmpeg -i ${tempInput} -c:v libx264 -profile:v main -level 3.1 -pix_fmt yuv420p -vf "scale='min(1280,iw)':-2" -c:a aac -b:a 128k -movflags +faststart -y ${tempOutput}`);
        
        const finalBuffer = fs.readFileSync(tempOutput);
        
        await sock.sendMessage(from, {
          video: finalBuffer,
          mimetype: 'video/mp4',
          fileName: `video_${timestamp}.mp4`,
          caption: `📹 *${title}*`,
          gifPlayback: false // Garante que seja enviado como vídeo normal
        }, { quoted: info });
      } catch (ffmpegErr) {
        console.error('Erro FFmpeg:', ffmpegErr);
        // Fallback 1: Enviar como documento (sempre funciona para download, mesmo que não dê play direto)
        await sock.sendMessage(from, {
          document: buffer,
          mimetype: 'video/mp4',
          fileName: `${title}.mp4`,
          caption: `📹 *${title}*\n\n⚠️ O vídeo foi enviado como arquivo devido a uma incompatibilidade no player do seu WhatsApp.`
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
    // Limpar arquivos temporários com segurança
    try {
      if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
      if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    } catch (e) {}
  }
}

export { handleYouTubeDownloader };
