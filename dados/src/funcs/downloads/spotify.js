/**
 * Music Info & Downloader - Versão Simplificada e Robusta
 * Baixa áudio via API externa e envia o buffer direto para evitar erros de conversão.
 */

import axios from 'axios';

const DEEZER_API = 'https://api.deezer.com';
const SPOTIFY_OEMBED = 'https://open.spotify.com/oembed';
const DOWNLOAD_API = 'https://nayan-video-downloader.vercel.app/ytdown';

async function getSpotifyMetadata(url) {
  try {
    const response = await axios.get(SPOTIFY_OEMBED, { params: { url: url.split('?')[0] }, timeout: 10000 });
    return response.data?.title ? {
      ok: true,
      title: response.data.title,
      artists: response.data.author_name || 'Spotify Track',
      image: response.data.thumbnail_url || null,
      link: url.split('?')[0]
    } : null;
  } catch { return null; }
}

async function getInfo(urlOrName) {
  try {
    if (urlOrName.includes('spotify.com')) {
      const data = await getSpotifyMetadata(urlOrName);
      if (data) return data;
    }
    const response = await axios.get(`${DEEZER_API}/search`, { params: { q: urlOrName }, timeout: 15000 });
    const track = response.data?.data?.[0];
    return track ? {
      ok: true,
      title: track.title,
      artists: track.artist.name,
      image: track.album.cover_medium,
      link: track.link
    } : { ok: false, msg: 'Música não encontrada.' };
  } catch { return { ok: false, msg: 'Erro ao buscar informações.' }; }
}

async function download(urlOrName) {
  const info = await getInfo(urlOrName);
  if (!info.ok) return info;

  try {
    const query = `${info.title} ${info.artists} audio`;
    const ytSearch = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const ytId = ytSearch.data.match(/"videoId":"([^"]+)"/)?.[1];
    if (!ytId) throw new Error('Vídeo não encontrado.');

    const dlResponse = await axios.get(DOWNLOAD_API, { params: { url: `https://www.youtube.com/watch?v=${ytId}` }, timeout: 30000 });
    const audioUrl = dlResponse.data?.data?.audio || dlResponse.data?.audio;
    if (!audioUrl) throw new Error('Link de download falhou.');

    const file = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 60000 });
    return {
      ok: true,
      buffer: Buffer.from(file.data),
      filename: `${info.title.replace(/[\\/:*?"<>|]/g, '')}.mp3`,
      info
    };
  } catch (error) {
    return { ok: false, msg: 'Erro no download.' };
  }
}

export default { download, getInfo };
