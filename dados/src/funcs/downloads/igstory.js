/**
 * Instagram Story Download - Implementação para download de stories
 * Usa API pública para obter stories do Instagram
 */

import axios from 'axios';
import { mediaClient } from '../../utils/httpClient.js';

const BASE_URL = 'https://nayan-video-downloader.vercel.app/ndown';

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
 * Extrai o username da URL do Instagram
 * @param {string} url - URL do Instagram
 * @returns {string|null} Username ou null
 */
function extractUsername(url) {
  try {
    // Padrões de URL do Instagram para stories
    // https://www.instagram.com/stories/username/
    // https://instagram.com/stories/username/
    const storyMatch = url.match(/instagram\.com\/stories\/([^\/\?]+)/i);
    if (storyMatch) return storyMatch[1];
    
    // https://www.instagram.com/username/
    const profileMatch = url.match(/instagram\.com\/([^\/\?]+)/i);
    if (profileMatch && profileMatch[1] !== 'stories') return profileMatch[1];
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Faz download de story do Instagram
 * @param {string} url - URL do story do Instagram
 * @returns {Promise<Object>} Dados do download
 */
async function dlStory(url) {
  try {
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return {
        ok: false,
        msg: 'URL inválida'
      };
    }

    // Verificar se é URL de story
    const username = extractUsername(url);
    if (!username) {
      return {
        ok: false,
        msg: 'URL de story inválida. Use o formato: https://www.instagram.com/stories/username/'
      };
    }

    // Verificar cache
    const cached = getCached(`story:${url}`);
    if (cached) return { ok: true, ...cached, cached: true };

    // Tentar baixar usando a API nayan-video-downloader
    const response = await axios.get(`${BASE_URL}?url=${encodeURIComponent(url)}`, {
      timeout: 120000
    });

    if (!response.data?.data?.length) {
      return {
        ok: false,
        msg: 'Story não encontrado ou já expirou. Stories do Instagram ficam disponíveis apenas por 24 horas.'
      };
    }

    const results = [];
    const uniqueUrls = new Set();

    // Processar cada item de mídia
    for (const item of response.data.data) {
      if (uniqueUrls.has(item.url)) continue;
      uniqueUrls.add(item.url);

      try {
        // Verificar tipo de mídia via HEAD request
        const headResponse = await axios.head(item.url, { timeout: 30000 });
        const contentType = headResponse.headers['content-type'] || '';
        
        // Baixar o conteúdo usando o mediaClient otimizado
        const mediaResponse = await mediaClient.get(item.url, {
          timeout: 120000
        });
        
        results.push({
          type: contentType.startsWith('image/') ? 'image' : 'video',
          buff: mediaResponse.data,
          url: item.url,
          mime: contentType || 'application/octet-stream'
        });
      } catch (downloadError) {
        console.error('Erro ao baixar mídia do story:', downloadError.message);
        // Continua com as outras mídias mesmo se uma falhar
      }
    }

    if (results.length === 0) {
      return {
        ok: false,
        msg: 'Nenhuma mídia foi baixada com sucesso. O story pode ter expirado ou não está mais disponível.'
      };
    }

    const result = {
      criador: 'Hiudy',
      username: username,
      data: results,
      count: results.length
    };

    setCache(`story:${url}`, result);

    return {
      ok: true,
      ...result
    };
  } catch (error) {
    console.error('Erro no download de story do Instagram:', error.message);
    
    // Mensagens de erro mais específicas
    if (error.response?.status === 404) {
      return {
        ok: false,
        msg: 'Story não encontrado. Verifique se o link está correto e se o story ainda está disponível.'
      };
    }
    
    return {
      ok: false,
      msg: 'Erro ao baixar story: ' + error.message
    };
  }
}

/**
 * Handler para processar download de story via WhatsApp
 * @param {Object} sock - Socket do WhatsApp
 * @param {string} from - ID do chat
 * @param {string} url - URL do story
 * @param {Object} info - Informações da mensagem
 */
async function handleInstagramStoryDownloader(sock, from, url, info) {
  if (!url.startsWith('http')) {
    await sock.sendMessage(from, { text: '❌ URL inválida' }, { quoted: info });
    return;
  }

  try {
    const result = await dlStory(url);

    if (!result.ok) {
      await sock.sendMessage(from, { text: `❌ ${result.msg}` }, { quoted: info });
      return;
    }

    // Enviar mensagem informativa
    await sock.sendMessage(from, {
      text: `✅ Story de @${result.username} encontrado!\n📦 ${result.count} mídia(s) para download...`
    }, { quoted: info });

    // Enviar cada mídia
    for (const media of result.data) {
      const buffer = Buffer.from(media.buff);
      
      if (media.type === 'image') {
        await sock.sendMessage(from, {
          image: buffer,
          caption: `📸 Story de @${result.username}`
        }, { quoted: info });
      } else {
        await sock.sendMessage(from, {
          video: buffer,
          mimetype: 'video/mp4',
          caption: `📹 Story de @${result.username}`
        }, { quoted: info });
      }
    }

  } catch (err) {
    console.error('❌ Erro ao baixar story do Instagram:', err.message);
    await sock.sendMessage(from, { 
      text: '❌ Falha ao baixar story do Instagram. Tente novamente ou verifique se o story ainda está disponível.' 
    }, { quoted: info });
  }
}

export { 
  dlStory,
  handleInstagramStoryDownloader
};
