/**
 * Music Info & Downloader - Busca informações e faz download de áudios completos.
 * Refatorado para usar APIs externas estáveis, garantindo compatibilidade com o Railway
 * sem depender de binários locais como yt-dlp.
 */

import axios from 'axios';

const DEEZER_API = 'https://api.deezer.com';
const SPOTIFY_OEMBED = 'https://open.spotify.com/oembed';
const DOWNLOAD_API = 'https://nayan-video-downloader.vercel.app/ytdown';

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

function sanitizeFileName(name = 'audio') {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'audio';
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
      album: 'Spotify',
      image: data.thumbnail_url || null,
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
 * Busca músicas usando a API do Deezer
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
    if (urlOrName.includes('spotify.com')) {
      const spotifyData = await getSpotifyMetadata(urlOrName);
      if (spotifyData) return spotifyData;
      return { ok: false, msg: 'Não foi possível ler este link do Spotify.' };
    }

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

    const searchResult = await search(urlOrName, 1);
    if (searchResult.ok && searchResult.results.length > 0) {
      const track = searchResult.results[0];
      return { 
        ok: true, 
        title: track.name, 
        artists: track.artists, 
        album: track.album, 
        image: track.image, 
        link: track.link, 
        source: 'Deezer' 
      };
    }

    return { ok: false, msg: 'Música não encontrada.' };
  } catch (error) {
    console.error('Erro ao obter info:', error.message);
    return { ok: false, msg: 'Erro ao processar informações.' };
  }
}

/**
 * Faz o download do áudio completo via API externa estável.
 */
async function download(urlOrName) {
  const info = await getInfo(urlOrName);
  if (!info.ok) return info;

  try {
    // 1. Primeiro tentamos obter um link do YouTube para a música
    const query = `${info.title} ${info.artists} audio`;
    const ytSearchResponse = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const ytIdMatch = ytSearchResponse.data.match(/"videoId":"([^"]+)"/);
    if (!ytIdMatch) throw new Error('Vídeo não encontrado no YouTube.');
    
    const ytUrl = `https://www.youtube.com/watch?v=${ytIdMatch[1]}`;

    // 2. Usamos a API externa para obter o link de download do áudio
    const dlResponse = await axios.get(DOWNLOAD_API, {
      params: { url: ytUrl },
      timeout: 30000
    });

    const body = dlResponse.data;
    const media = (body.data && body.data.audio) ? body.data : (body.audio ? body : null);

    if (!media || !media.audio) {
      throw new Error('Link de download não disponível.');
    }

    // 3. Baixamos o buffer do áudio
    const fileResponse = await axios.get(media.audio, {
      responseType: 'arraybuffer',
      timeout: 60000
    });

    const buffer = Buffer.from(fileResponse.data);
    const filename = `${sanitizeFileName(`${info.title} - ${info.artists}`)}.mp3`;

    return {
      ok: true,
      buffer,
      filename,
      title: info.title,
      artists: info.artists,
      image: info.image,
      info
    };
  } catch (error) {
    console.error('Erro no download via API externa:', error.message);
    return {
      ok: false,
      msg: 'Não foi possível baixar o áudio completo. Tente novamente mais tarde.',
      info
    };
  }
}

export default {
  download,
  search,
  getInfo
};
