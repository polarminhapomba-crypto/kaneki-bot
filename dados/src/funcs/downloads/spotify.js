/**
 * Spotify Download - Versão Estável (Lógica SoundCloud)
 * Esta versão utiliza a mesma API e método de envio do comando /SoundCloud,
 * garantindo compatibilidade total com o servidor Railway e o player do WhatsApp.
 */

import axios from 'axios';
import { mediaClient } from '../../utils/httpClient.js';
import NodeID3 from 'node-id3';

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
        artists: response.data.author_name || '',
        image: response.data.thumbnail_url || null
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
    let spotifyImage = null;
    let spotifyArtists = '';

    // 1. Identificar a música
    if (urlOrName.includes('spotify.com')) {
      const meta = await getSpotifyMetadata(urlOrName);
      if (!meta) return { ok: false, msg: 'Link do Spotify inválido ou privado.' };
      query = `${meta.title} ${meta.artists}`;
      displayTitle = meta.title;
      spotifyImage = meta.image;
      spotifyArtists = meta.artists;
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
      responseType: 'arraybuffer',
      timeout: 60000
    });

    let audioBuffer = Buffer.from(audioResponse.data);
    const finalTitle = displayTitle || dlData.title;
    const finalArtists = spotifyArtists || dlData.artist;
    const finalImage = spotifyImage || dlData.thumbnail;

    // 5. Adicionar metadados ID3 (Capa e Nome)
    try {
      const tags = {
        title: finalTitle,
        artist: finalArtists,
      };

      if (finalImage) {
        const imageResponse = await axios.get(finalImage, { responseType: 'arraybuffer' });
        tags.image = {
          mime: "image/jpeg",
          type: {
            id: 3,
            name: "front cover"
          },
          description: "Cover",
          imageBuffer: Buffer.from(imageResponse.data)
        };
      }

      const success = NodeID3.write(tags, audioBuffer);
      if (success) {
        audioBuffer = success;
      }
    } catch (id3Error) {
      console.error('Erro ao adicionar tags ID3:', id3Error.message);
    }

    return {
      ok: true,
      buffer: audioBuffer,
      title: finalTitle,
      artists: finalArtists,
      filename: `${finalTitle}.mp3`,
      thumbnail: finalImage
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
      return meta ? { ok: true, ...meta, link: q } : { ok: false };
    }
    // Para buscas que não são links, tentamos buscar no SoundCloud para pegar a imagem
    try {
      const searchResponse = await axios.get(`${BASE_URL}/soundcloud-search`, {
        params: { name: q, limit: 1 },
        timeout: 10000
      });
      if (searchResponse.data?.results?.length) {
        const track = searchResponse.data.results[0];
        return {
          ok: true,
          title: track.title,
          artists: track.user_id,
          image: track.artwork_url,
          link: track.permalink_url
        };
      }
    } catch (e) {}
    return { ok: true, title: q, artists: '', image: null, link: q };
  },
  search: async (q, limit = 1) => {
    try {
      const searchResponse = await axios.get(`${BASE_URL}/soundcloud-search`, {
        params: { name: q, limit },
        timeout: 10000
      });
      if (searchResponse.data?.results?.length) {
        return {
          ok: true,
          results: searchResponse.data.results.map(t => ({
            name: t.title,
            artists: t.user_id,
            image: t.artwork_url,
            link: t.permalink_url,
            album: 'SoundCloud'
          }))
        };
      }
      return { ok: false };
    } catch (e) { return { ok: false }; }
  }
};
