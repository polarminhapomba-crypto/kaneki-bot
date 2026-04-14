/**
 * Music Info - Busca informações de músicas de forma estável
 * Refatorado para suportar links diretos do Spotify (oEmbed) e busca via Deezer
 */

import axios from 'axios';

const DEEZER_API = 'https://api.deezer.com';
const SPOTIFY_OEMBED = 'https://open.spotify.com/oembed';

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

/**
 * Obtém metadados de um link do Spotify usando oEmbed (oficial e estável)
 */
async function getSpotifyMetadata(url) {
    try {
        const cleanUrl = url.split('?')[0]; // Remove parâmetros de tracking
        const cached = getCached(`spotify:${cleanUrl}`);
        if (cached) return cached;

        const response = await axios.get(SPOTIFY_OEMBED, {
            params: { url: cleanUrl },
            timeout: 10000
        });

        if (!response.data || !response.data.title) {
            return null;
        }

        const data = response.data;
        // O título do oEmbed costuma ser apenas o nome da música
        // Para links do Spotify, o oEmbed é excelente para pegar a capa e o título
        const result = {
            ok: true,
            title: data.title,
            artists: 'Spotify Track', // oEmbed não separa artista nativamente de forma simples no título
            album: 'Spotify',
            image: data.thumbnail_url,
            link: cleanUrl,
            source: 'Spotify'
        };

        setCache(`spotify:${cleanUrl}`, result);
        return result;
    } catch (error) {
        console.error('Erro no oEmbed do Spotify:', error.message);
        return null;
    }
}

/**
 * Busca músicas usando a API do Deezer (estável)
 */
async function search(query, limit = 10) {
  try {
    const cached = getCached(`search:${query}:${limit}`);
    if (cached) return cached;

    const response = await axios.get(`${DEEZER_API}/search`, {
      params: { q: query },
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
        duration: track.duration,
        source: 'Deezer'
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
 * Obtém informações detalhadas de um link ou nome
 */
async function getInfo(urlOrName) {
  try {
    // Se for link do Spotify, usa o oEmbed
    if (urlOrName.includes('spotify.com')) {
        const spotifyData = await getSpotifyMetadata(urlOrName);
        if (spotifyData) return spotifyData;
        
        // Fallback: se o oEmbed falhar, tenta buscar o título via Deezer (extraindo da URL se possível)
        return { ok: false, msg: 'Não foi possível ler este link do Spotify. Tente buscar pelo nome!' };
    }

    // Se for link do Deezer
    if (urlOrName.includes('deezer.com')) {
        const trackId = urlOrName.split('/').pop();
        const response = await axios.get(`${DEEZER_API}/track/${trackId}`);
        if (response.data && !response.data.error) {
            const track = response.data;
            return {
                ok: true,
                title: track.title,
                artists: track.artist.name,
                album: track.album.title,
                image: track.album.cover_medium,
                link: track.link,
                source: 'Deezer'
            };
        }
    }

    // Se for apenas texto, faz uma busca
    const searchResult = await search(urlOrName, 1);
    if (searchResult.ok && searchResult.results.length > 0) {
        return { ok: true, ...searchResult.results[0] };
    }

    return { ok: false, msg: 'Música não encontrada.' };
  } catch (error) {
    console.error('Erro ao obter info:', error.message);
    return { ok: false, msg: 'Erro ao processar informações.' };
  }
}

async function download(url) {
  return {
    ok: false,
    msg: 'Download desativado por segurança.'
  };
}

export default {
  download,
  search,
  getInfo
};
