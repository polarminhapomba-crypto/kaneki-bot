/**
 * Instagram Post & Story Download - Comando /insta-post
 * Detecta automaticamente se a URL é de um post ou story
 * e faz o download das fotos/vídeos correspondentes.
 */

import axios from 'axios';
import { mediaClient } from '../../utils/httpClient.js';

const INSTA_APIS = [
  'https://nayan-video-downloader.vercel.app/ndown',
  'https://api.vreden.my.id/api/igdl',
  'https://api.vreden.my.id/api/igstory'
];

// Cache simples
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return item.val;
}

function setCache(key, val) {
  if (cache.size >= 1000) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { val, ts: Date.now() });
}

/**
 * Detecta se a URL é de um story do Instagram
 * @param {string} url
 * @returns {boolean}
 */
function isStoryUrl(url) {
  return /instagram\.com\/stories\//i.test(url);
}

/**
 * Extrai o username da URL de story
 * @param {string} url
 * @returns {string|null}
 */
function extractUsername(url) {
  const match = url.match(/instagram\.com\/stories\/([^\/\?]+)/i);
  return match ? match[1] : null;
}

/**
 * Faz download de post ou story do Instagram
 * @param {string} url - URL do post ou story
 * @returns {Promise<Object>}
 */
async function downloadInstaPost(url) {
  try {
    if (!url || typeof url !== 'string' || !url.trim()) {
      return { ok: false, msg: 'URL inválida.' };
    }

    // Normaliza URL removendo parâmetros de rastreio que podem quebrar o download
    const cleanUrl = url.split('?')[0].split('&')[0];

    const cached = getCached(`instapost:${cleanUrl}`);
    if (cached) return { ok: true, ...cached, cached: true };

    let successData = null;
    let lastError = null;

    // Tenta em múltiplas APIs para garantir o download
    for (const apiBase of INSTA_APIS) {
      try {
        const response = await axios.get(`${apiBase}?url=${encodeURIComponent(cleanUrl)}`, {
          timeout: 45000
        });

        const rawData = response.data?.data || response.data?.result || response.data;
        const mediaList = Array.isArray(rawData) ? rawData : (rawData?.url ? [rawData] : []);

        if (mediaList.length > 0) {
          successData = mediaList;
          break;
        }
      } catch (e) {
        lastError = e.message;
        continue;
      }
    }

    if (!successData || successData.length === 0) {
      return {
        ok: false,
        msg: isStoryUrl(url) || url.includes('/s/')
          ? 'Story/Destaque não encontrado ou já expirou. Verifique se o perfil é público.'
          : 'Postagem não encontrada. Verifique se o link está correto e se o perfil é público.'
      };
    }

    const results = [];
    const uniqueUrls = new Set();

    for (const item of successData) {
      const mediaUrl = item.url || item.downloadUrl || (typeof item === 'string' ? item : null);
      if (!mediaUrl || uniqueUrls.has(mediaUrl)) continue;
      uniqueUrls.add(mediaUrl);

      try {
        // Tenta obter o buffer da mídia
        const mediaResponse = await mediaClient.get(mediaUrl, { timeout: 60000 });
        const contentType = mediaResponse.headers['content-type'] || '';

        results.push({
          type: contentType.startsWith('image/') ? 'image' : 'video',
          buff: mediaResponse.data,
          url: mediaUrl,
          mime: contentType || 'application/octet-stream'
        });
      } catch (dlErr) {
        console.error('[instapost] Erro ao baixar mídia individual:', dlErr.message);
      }
    }

    if (results.length === 0) {
      return { ok: false, msg: 'Nenhuma mídia foi baixada com sucesso.' };
    }

    const result = {
      isStory: isStoryUrl(cleanUrl),
      username: isStoryUrl(cleanUrl) ? extractUsername(cleanUrl) : null,
      data: results,
      count: results.length
    };

    setCache(`instapost:${cleanUrl}`, result);

    return { ok: true, ...result };
  } catch (error) {
    console.error('[instapost] Erro:', error.message);

    if (error.response?.status === 404) {
      return { ok: false, msg: 'Conteúdo não encontrado. Verifique se o link está correto.' };
    }

    return { ok: false, msg: 'Erro ao baixar do Instagram: ' + error.message };
  }
}

/**
 * Handler principal do comando /insta-post para WhatsApp
 * @param {Object} sock - Socket do WhatsApp (nazu)
 * @param {string} from - ID do chat
 * @param {string} url - URL do post ou story
 * @param {Object} info - Informações da mensagem
 */
async function handleInstaPost(sock, from, url, info) {
  if (!url || !url.startsWith('http')) {
    await sock.sendMessage(from, {
      text: '❌ URL inválida. Por favor, envie um link válido do Instagram.'
    }, { quoted: info });
    return;
  }

  const isStory = isStoryUrl(url);

  try {
    const result = await downloadInstaPost(url);

    if (!result.ok) {
      await sock.sendMessage(from, { text: `❌ ${result.msg}` }, { quoted: info });
      return;
    }

    const label = isStory
      ? `📖 Story${result.username ? ` de @${result.username}` : ''}`
      : '📸 Instagram';

    // Enviar cada mídia
    for (const media of result.data) {
      const buffer = Buffer.from(media.buff);

      if (media.type === 'image') {
        await sock.sendMessage(from, {
          image: buffer,
          caption: `${label}`
        }, { quoted: info });
      } else {
        await sock.sendMessage(from, {
          video: buffer,
          mimetype: 'video/mp4',
          caption: `${label}`
        }, { quoted: info });
      }
    }

  } catch (err) {
    console.error('[instapost] Erro no handler:', err.message);
    await sock.sendMessage(from, {
      text: '❌ Falha ao baixar do Instagram. Tente novamente ou verifique se o conteúdo ainda está disponível.'
    }, { quoted: info });
  }
}

export { downloadInstaPost, handleInstaPost };
