/**
 * Instagram Post & Story Download - Comando /insta-post
 * Detecta automaticamente se a URL é de um post ou story
 * e faz o download das fotos/vídeos correspondentes.
 */

import axios from 'axios';
import { mediaClient } from '../../utils/httpClient.js';

const NAYAN_API = 'https://nayan-video-downloader.vercel.app/ndown';

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

    const cached = getCached(`instapost:${url}`);
    if (cached) return { ok: true, ...cached, cached: true };

    const response = await axios.get(`${NAYAN_API}?url=${encodeURIComponent(url)}`, {
      timeout: 120000
    });

    if (!response.data?.data?.length) {
      return {
        ok: false,
        msg: isStoryUrl(url)
          ? 'Story não encontrado ou já expirou. Stories ficam disponíveis por apenas 24 horas.'
          : 'Postagem não encontrada. Verifique se o link está correto e se o perfil é público.'
      };
    }

    const results = [];
    const uniqueUrls = new Set();

    for (const item of response.data.data) {
      if (uniqueUrls.has(item.url)) continue;
      uniqueUrls.add(item.url);

      try {
        const headResponse = await axios.head(item.url, { timeout: 30000 });
        const contentType = headResponse.headers['content-type'] || '';

        const mediaResponse = await mediaClient.get(item.url, { timeout: 120000 });

        results.push({
          type: contentType.startsWith('image/') ? 'image' : 'video',
          buff: mediaResponse.data,
          url: item.url,
          mime: contentType || 'application/octet-stream'
        });
      } catch (dlErr) {
        console.error('[instapost] Erro ao baixar mídia:', dlErr.message);
      }
    }

    if (results.length === 0) {
      return { ok: false, msg: 'Nenhuma mídia foi baixada com sucesso.' };
    }

    const result = {
      isStory: isStoryUrl(url),
      username: isStoryUrl(url) ? extractUsername(url) : null,
      data: results,
      count: results.length
    };

    setCache(`instapost:${url}`, result);

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
