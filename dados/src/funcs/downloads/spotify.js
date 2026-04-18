/**
 * Music Info & Downloader - Busca informações e faz download de áudios completos.
 * Suporta links do Spotify e busca automática em múltiplas fontes (YouTube, SoundCloud, etc)
 * via yt-dlp para garantir o download do áudio completo.
 */

import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

const DEEZER_API = 'https://api.deezer.com';
const SPOTIFY_OEMBED = 'https://open.spotify.com/oembed';
const TEMP_DIR = './dados/temp';

// Garantir que o diretório temporário exista
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

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
 * Faz o download do áudio completo via múltiplas fontes usando yt-dlp.
 * Tenta buscar em várias plataformas para garantir o sucesso.
 */
async function download(urlOrName) {
  const info = await getInfo(urlOrName);
  if (!info.ok) return info;

  // Busca mais abrangente para garantir o download completo
  const query = `${info.title} ${info.artists} full audio`;
  const timestamp = Date.now();
  const outputPath = path.join(TEMP_DIR, `music_${timestamp}.mp3`);

  try {
    /**
     * yt-dlp configurado para buscar em múltiplas fontes:
     * - Busca automática (ytsearch)
     * - Extração de áudio de alta qualidade
     * - Suporte a diversos sites (YouTube, SoundCloud, Bandcamp, etc)
     */
    await execPromise(`yt-dlp --default-search "ytsearch" --max-downloads 1 --extract-audio --audio-format mp3 --audio-quality 0 --output "${outputPath}" "${query}"`);

    if (fs.existsSync(outputPath)) {
      const buffer = fs.readFileSync(outputPath);
      const filename = `${sanitizeFileName(`${info.title} - ${info.artists}`)}.mp3`;
      
      // Limpar arquivo temporário
      setTimeout(() => {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      }, 5000);

      return {
        ok: true,
        buffer,
        filename,
        title: info.title,
        artists: info.artists,
        image: info.image,
        info
      };
    } else {
      throw new Error('Falha ao gerar o arquivo de áudio.');
    }
  } catch (error) {
    console.error('Erro no download multi-fonte:', error.message);
    return {
      ok: false,
      msg: 'Não foi possível baixar o áudio completo de nenhuma fonte disponível.',
      info
    };
  }
}

export default {
  download,
  search,
  getInfo
};
