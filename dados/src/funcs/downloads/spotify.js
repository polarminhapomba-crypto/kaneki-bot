/**
 * Spotify Download - Versão Estável (Lógica SoundCloud)
 * Esta versão utiliza a mesma API e método de envio do comando /SoundCloud,
 * garantindo compatibilidade total com o servidor Railway e o player do WhatsApp.
 */

import axios from 'axios';
import { mediaClient } from '../../utils/httpClient.js';

const BASE_URL = 'https://nayan-video-downloader.vercel.app';
const SPOTIFY_OEMBED = 'https://open.spotify.com/oembed';

/**
 * Obtém o nome da música a partir do link do Spotify
 */
async function getSpotifyMetadata(url) {
  try {
    const response = await axios.get(SPOTIFY_OEMBED, {
      params: { url: url.split('?')[0] },
      timeout: 10000
    });
    if (response.data && response.data.title) {
      return {
        title: response.data.title,
        artists: response.data.author_name || ''
      };
    }
    return null;
  } catch (error) {
    console.error('Erro ao ler metadados do Spotify:', error.message);
    return null;
  }
}

/**
 * Faz o download usando a API estável do SoundCloud
 */
async function download(urlOrName) {
  try {
    let query;
    let displayTitle = '';

    // 1. Identificar a música
    if (urlOrName.includes('spotify.com')) {
      const meta = await getSpotifyMetadata(urlOrName);
      if (!meta) return { ok: false, msg: 'Link do Spotify inválido ou privado.' };
      query = `${meta.title} ${meta.artists}`;
      displayTitle = meta.title;
    } else {
      query = urlOrName;
    }

    // 2. Buscar no SoundCloud (API estável)
    const searchResponse = await axios.get(`${BASE_URL}/soundcloud-search`, {
      params: { name: query, limit: 1 },
      timeout: 30000
    });

    if (!searchResponse.data?.results?.length) {
      return { ok: false, msg: 'Música não encontrada nos servidores de áudio.' };
    }

    const track = searchResponse.data.results[0];

    // 3. Obter link de download direto
    const dlResponse = await axios.get(`${BASE_URL}/soundcloud`, {
      params: { url: track.permalink_url },
      timeout: 30000
    });

    if (!dlResponse.data?.data?.download_url) {
      return { ok: false, msg: 'Falha ao gerar link de download.' };
    }

    const dlData = dlResponse.data.data;

    // 4. Baixar o buffer de áudio (usando o cliente de mídia do bot)
    const audioResponse = await mediaClient.get(dlData.download_url, {
      timeout: 60000
    });

    return {
      ok: true,
      buffer: Buffer.from(audioResponse.data),
      title: displayTitle || dlData.title,
      artists: dlData.artist,
      filename: `${displayTitle || dlData.title}.mp3`,
      thumbnail: dlData.thumbnail
    };
  } catch (error) {
    console.error('Erro no processo de download estável:', error.message);
    return { ok: false, msg: 'Erro temporário no servidor de download.' };
  }
}

export default {
  download,
  getInfo: async (q) => {
    if (q.includes('spotify.com')) {
      const meta = await getSpotifyMetadata(q);
      return meta ? { ok: true, ...meta, image: null, link: q } : { ok: false };
    }
    return { ok: true, title: q, artists: '', image: null, link: q };
  }
};
