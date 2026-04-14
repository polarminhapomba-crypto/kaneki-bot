/**
 * Music Info - Busca informações de músicas de forma estável
 * Refatorado para usar a API do Deezer (mais estável e sem 403)
 * Mantém compatibilidade com a estrutura do bot Kaneki
 */

import axios from 'axios';

const DEEZER_API = 'https://api.deezer.com';

// Cache simples para evitar excesso de requisições
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

/**
 * Busca músicas usando a API do Deezer (estável)
 */
async function search(query, limit = 10) {
  try {
    const cached = getCached(`search:${query}:${limit}`);
    if (cached) return cached;

    // Limpa a query se for um link do Spotify para tentar buscar o título
    let searchQuery = query;
    if (query.includes('spotify.com/track/')) {
        // Como não temos uma API de Spotify estável, vamos avisar que links diretos 
        // precisam de busca por nome ou usar um placeholder
        return { ok: false, msg: 'Para links do Spotify, use o comando por nome da música!' };
    }

    const response = await axios.get(`${DEEZER_API}/search`, {
      params: { q: searchQuery },
      timeout: 15000
    });

    if (!response.data || !response.data.data) {
      return { ok: false, msg: 'Nenhuma música encontrada.' };
    }

    const results = response.data.data.slice(0, limit).map(track => ({
        name: track.title,
        artists: track.artist.name,
        album: track.album.title,
        image: track.album.cover_medium,
        link: track.link,
        duration: track.duration
    }));

    const result = {
      ok: true,
      query,
      total: results.length,
      results: results
    };

    setCache(`search:${query}:${limit}`, result);
    return result;
  } catch (error) {
    console.error('Erro na busca de música:', error.message);
    return { ok: false, msg: 'Erro ao conectar com o serviço de música.' };
  }
}

/**
 * Obtém informações detalhadas (Simulado via Deezer para estabilidade)
 */
async function getInfo(urlOrName) {
  try {
    // Se for link do Spotify, tentamos extrair algo ou pedimos busca por nome
    if (urlOrName.includes('spotify.com')) {
        return { ok: false, msg: 'Links do Spotify estão instáveis. Tente buscar pelo nome da música!' };
    }

    const searchResult = await search(urlOrName, 1);
    if (!searchResult.ok || !searchResult.results.length) {
        return searchResult;
    }

    const track = searchResult.results[0];
    return {
        ok: true,
        title: track.name,
        artists: track.artists,
        album: track.album,
        image: track.image,
        link: track.link
    };
  } catch (error) {
    console.error('Erro ao obter info:', error.message);
    return { ok: false, msg: 'Erro ao processar informações.' };
  }
}

// Mantém compatibilidade com a interface que o index.js espera
async function download(url) {
  return {
    ok: false,
    msg: 'Download desativado. Use o link oficial para ouvir.'
  };
}

export default {
  download,
  search,
  getInfo
};
