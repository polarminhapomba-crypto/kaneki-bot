/**
 * Spotify Info - Busca informações de músicas no Spotify
 * Refatorado para fornecer apenas metadados e links oficiais
 */

import axios from 'axios';

const SEARCH_BASE_URL = 'https://nayan-video-downloader.vercel.app';
const DOWNLOAD_BASE_URL = 'https://spotisaver.net';

// Cache simples
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

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
  if (cache.size >= 500) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { val, ts: Date.now() });
}

const SPOTISAVER_HEADERS = {
  'accept': '*/*',
  'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
};

function extractTrackId(url) {
  const trackMatch = url.match(/track\/([a-zA-Z0-9]+)/);
  return trackMatch ? trackMatch[1] : null;
}

/**
 * Busca músicas no Spotify
 */
async function search(query, limit = 10) {
  try {
    const cached = getCached(`search:${query}:${limit}`);
    if (cached) return cached;

    const response = await axios.get(`${SEARCH_BASE_URL}/spotify-search`, {
      params: {
        name: query,
        limit: Math.min(limit, 50)
      },
      timeout: 60000
    });

    if (!response.data || response.data.status !== 200) {
      return { ok: false, msg: 'Erro ao buscar no Spotify' };
    }

    const result = {
      ok: true,
      query,
      total: response.data.results?.length || 0,
      results: response.data.results || []
    };

    setCache(`search:${query}:${limit}`, result);
    return result;
  } catch (error) {
    console.error('Erro na busca do Spotify:', error.message);
    return { ok: false, msg: 'Erro ao buscar no Spotify' };
  }
}

/**
 * Obtém informações detalhadas de uma música
 */
async function getInfo(url) {
  try {
    if (!url || !url.includes('spotify.com')) {
      return { ok: false, msg: 'URL inválida do Spotify' };
    }

    const trackId = extractTrackId(url);
    if (!trackId) return { ok: false, msg: 'ID da música não encontrado' };

    const cached = getCached(`info:${trackId}`);
    if (cached) return cached;

    const infoResponse = await axios.get(`${DOWNLOAD_BASE_URL}/api/get_playlist.php`, {
      params: { id: trackId, type: 'track', lang: 'en' },
      headers: { ...SPOTISAVER_HEADERS, 'referer': `${DOWNLOAD_BASE_URL}/en/track/${trackId}/` },
      timeout: 60000
    });

    const trackData = infoResponse.data?.tracks?.[0];
    if (!trackData) return { ok: false, msg: 'Música não encontrada' };

    const result = {
      ok: true,
      title: trackData.name,
      artists: trackData.artists || [],
      album: trackData.album,
      image: trackData.image?.url,
      link: trackData.external_url || url,
      release_date: trackData.release_date,
      duration_ms: trackData.duration_ms
    };

    setCache(`info:${trackId}`, result);
    return result;
  } catch (error) {
    console.error('Erro ao obter info do Spotify:', error.message);
    return { ok: false, msg: 'Erro ao processar informações da música' };
  }
}

// Mantém a compatibilidade com a interface antiga mas altera o comportamento
async function download(url) {
  const info = await getInfo(url);
  if (!info.ok) return info;
  
  return {
    ...info,
    isInfoOnly: true,
    msg: 'Download desativado. Use o link oficial para ouvir.'
  };
}

async function searchDownload(query) {
  const searchResult = await search(query, 1);
  if (!searchResult.ok || !searchResult.results?.length) return searchResult;
  
  const track = searchResult.results[0];
  return download(track.link);
}

export default {
  download,
  search,
  searchDownload,
  getInfo
};
