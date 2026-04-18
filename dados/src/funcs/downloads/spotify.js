/**
 * Music Info - Busca informações de músicas de forma estável
 * Refatorado para suportar links diretos do Spotify (oEmbed) e busca via Deezer,
 * incluindo prévia de áudio quando a plataforma disponibilizar esse recurso.
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

function sanitizeFileName(name = 'audio') {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'audio';
}

function normalizeText(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function scoreTrackMatch(baseTitle = '', baseArtists = '', candidate = {}) {
  const refTitle = normalizeText(baseTitle);
  const refArtists = normalizeText(baseArtists);
  const candTitle = normalizeText(candidate.title || candidate.name);
  const candArtist = normalizeText(candidate.artist || candidate.artists);

  let score = 0;

  if (candTitle === refTitle) score += 80;
  else if (candTitle.includes(refTitle) || refTitle.includes(candTitle)) score += 45;

  if (refArtists && candArtist === refArtists) score += 20;
  else if (refArtists && (candArtist.includes(refArtists) || refArtists.includes(candArtist))) score += 10;

  return score;
}

async function fetchDeezerTrackById(trackId) {
  const cacheKey = `deezer:track:${trackId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await axios.get(`${DEEZER_API}/track/${trackId}`, {
    timeout: 15000
  });

  if (!response.data || response.data.error) {
    return null;
  }

  const track = response.data;
  const result = {
    ok: true,
    title: track.title,
    name: track.title,
    artists: track.artist?.name || 'Artista desconhecido',
    artist: track.artist?.name || 'Artista desconhecido',
    album: track.album?.title || 'Deezer',
    image: track.album?.cover_medium || track.album?.cover_big || null,
    link: track.link,
    preview: track.preview || null,
    duration: track.duration || null,
    source: 'Deezer'
  };

  setCache(cacheKey, result);
  return result;
}

async function searchDeezerTrack(query, limit = 5) {
  const cacheKey = `deezer:search:${query}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await axios.get(`${DEEZER_API}/search`, {
    params: { q: query },
    timeout: 15000
  });

  const results = (response.data?.data || []).slice(0, limit).map(track => ({
    ok: true,
    title: track.title,
    name: track.title,
    artists: track.artist?.name || 'Artista desconhecido',
    artist: track.artist?.name || 'Artista desconhecido',
    album: track.album?.title || 'Deezer',
    image: track.album?.cover_medium || null,
    link: track.link,
    preview: track.preview || null,
    duration: track.duration || null,
    source: 'Deezer'
  }));

  setCache(cacheKey, results);
  return results;
}

async function enrichWithPreview(baseInfo) {
  try {
    const artistText = Array.isArray(baseInfo.artists) ? baseInfo.artists.join(', ') : (baseInfo.artists || baseInfo.artist || '');
    const query = [baseInfo.title || baseInfo.name, artistText].filter(Boolean).join(' ');

    if (!query) {
      return baseInfo;
    }

    const candidates = await searchDeezerTrack(query, 5);
    if (!candidates.length) {
      return baseInfo;
    }

    const best = [...candidates]
      .map(candidate => ({
        ...candidate,
        _score: scoreTrackMatch(baseInfo.title || baseInfo.name, artistText, candidate)
      }))
      .sort((a, b) => b._score - a._score)[0];

    if (!best || best._score < 35) {
      return baseInfo;
    }

    return {
      ...baseInfo,
      artists: baseInfo.artists || best.artists,
      artist: baseInfo.artist || best.artist,
      album: baseInfo.album && baseInfo.album !== 'Spotify' ? baseInfo.album : best.album,
      preview: best.preview || null,
      previewSource: best.preview ? 'Deezer' : null,
      deezerLink: best.link || null,
      duration: baseInfo.duration || best.duration || null,
      image: baseInfo.image || best.image || null
    };
  } catch (error) {
    console.error('Erro ao enriquecer música com prévia:', error.message);
    return baseInfo;
  }
}

/**
 * Obtém metadados de um link do Spotify usando oEmbed (oficial e estável)
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
      name: data.title,
      artists: data.author_name || 'Spotify Track',
      artist: data.author_name || 'Spotify Track',
      album: 'Spotify',
      image: data.thumbnail_url || null,
      link: cleanUrl,
      source: 'Spotify',
      preview: null,
      previewSource: null
    };

    const enriched = await enrichWithPreview(result);
    setCache(`spotify:${cleanUrl}`, enriched);
    return enriched;
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

    const results = await searchDeezerTrack(query, limit);

    if (!results.length) {
      return { ok: false, msg: 'Nenhuma música encontrada.' };
    }

    const result = {
      ok: true,
      query,
      total: results.length,
      results
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

      return { ok: false, msg: 'Não foi possível ler este link do Spotify. Tente buscar pelo nome!' };
    }

    if (urlOrName.includes('deezer.com')) {
      const trackId = (urlOrName.split('?')[0].split('/').pop() || '').trim();
      const track = await fetchDeezerTrackById(trackId);
      if (track) return track;
    }

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

async function download(urlOrName) {
  try {
    const info = await getInfo(urlOrName);

    if (!info.ok) {
      return info;
    }

    if (!info.preview) {
      return {
        ok: false,
        msg: 'Nenhuma prévia de áudio foi disponibilizada para esta música.',
        info
      };
    }

    const response = await axios.get(info.preview, {
      responseType: 'arraybuffer',
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const artistText = Array.isArray(info.artists) ? info.artists.join(', ') : (info.artists || info.artist || 'artista');
    const filename = `${sanitizeFileName(`${info.title || info.name} - ${artistText}`)} (preview).mp3`;

    return {
      ok: true,
      type: 'preview',
      buffer: Buffer.from(response.data),
      filename,
      title: info.title || info.name,
      artists: artistText,
      image: info.image || null,
      link: info.link,
      previewSource: info.previewSource || info.source || 'Deezer',
      info
    };
  } catch (error) {
    console.error('Erro ao baixar prévia:', error.message);
    return {
      ok: false,
      msg: 'Não foi possível obter a prévia de áudio desta música.'
    };
  }
}

export default {
  download,
  search,
  getInfo
};
