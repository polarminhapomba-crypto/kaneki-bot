/**
 * Spotify Download - Implementação via busca no SoundCloud
 * Usa a mesma lógica que o comando /SoundCloud para garantir o download e envio.
 */

import axios from 'axios';
import { mediaClient } from '../../utils/httpClient.js';

const BASE_URL = 'https://nayan-video-downloader.vercel.app';
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
 * Obtém metadados de um link do Spotify usando oEmbed
 */
async function getSpotifyMetadata(url) {
  try {
    const cleanUrl = url.split('?')[0];
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
    const result = {
      ok: true,
      title: data.title,
      artists: data.author_name || 'Spotify Track',
      image: data.thumbnail_url || null,
      link: cleanUrl
    };

    setCache(`spotify:${cleanUrl}`, result);
    return result;
  } catch (error) {
    console.error('Erro no oEmbed do Spotify:', error.message);
    return null;
  }
}

/**
 * Busca e faz download usando a lógica do SoundCloud (que o usuário confirmou que funciona)
 */
async function download(urlOrName) {
  try {
    let title, artists, query;

    if (urlOrName.includes('spotify.com')) {
      const meta = await getSpotifyMetadata(urlOrName);
      if (!meta) return { ok: false, msg: 'Não foi possível ler o link do Spotify.' };
      title = meta.title;
      artists = meta.artists;
      query = `${title} ${artists}`;
    } else {
      query = urlOrName;
    }

    // 1. Buscar no SoundCloud (usando a API que o bot já usa)
    const searchResponse = await axios.get(`${BASE_URL}/soundcloud-search`, {
      params: { name: query, limit: 1 },
      timeout: 120000
    });

    if (searchResponse.data.status !== 200 || !searchResponse.data.results?.length) {
      return { ok: false, msg: 'Música não encontrada nos serviços de áudio.' };
    }

    const track = searchResponse.data.results[0];

    // 2. Obter link de download
    const dlResponse = await axios.get(`${BASE_URL}/soundcloud`, {
      params: { url: track.permalink_url },
      timeout: 120000
    });

    if (dlResponse.data.status !== 200 || !dlResponse.data.data) {
      return { ok: false, msg: 'Erro ao processar download do áudio.' };
    }

    const dlData = dlResponse.data.data;

    // 3. Baixar o buffer usando o mediaClient (igual ao SoundCloud)
    const audioResponse = await mediaClient.get(dlData.download_url, {
      timeout: 120000
    });

    return {
      ok: true,
      buffer: Buffer.from(audioResponse.data),
      title: title || dlData.title,
      artists: artists || dlData.artist,
      image: dlData.thumbnail,
      filename: `${title || dlData.title}.mp3`,
      info: {
          title: title || dlData.title,
          artists: artists || dlData.artist,
          image: dlData.thumbnail,
          link: urlOrName
      }
    };
  } catch (error) {
    console.error('Erro no download via SoundCloud logic:', error.message);
    return { ok: false, msg: 'Falha ao baixar áudio. Tente novamente.' };
  }
}

export default {
  download,
  getInfo: async (q) => {
      // Fallback simples para manter compatibilidade com o index.js
      if (q.includes('spotify.com')) return await getSpotifyMetadata(q);
      return { ok: true, title: q, artists: '', image: null, link: q };
  }
};
