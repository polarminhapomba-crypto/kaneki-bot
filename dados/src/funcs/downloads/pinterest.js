/**
 * Pinterest Download - Implementação via Scraping de HTML
 * Corrigido para suportar URLs curtas e extração via Meta Tags
 */

import axios from 'axios';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
};

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
  if (cache.size >= 1000) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { val, ts: Date.now() });
}

async function search(query) {
  try {
    const cached = getCached(\`search:\${query.toLowerCase()}\`);
    if (cached) return { ok: true, ...cached, cached: true };

    const response = await axios.get(\`https://br.pinterest.com/search/pins/?q=\${encodeURIComponent(query)}\`, {
      headers: HEADERS,
      timeout: 30000
    });

    const html = response.data;
    const images = new Set();
    const imgRegex = /"(https:\/\/i\.pinimg\.com\/[^"]+)"/g;
    let match;
    
    while ((match = imgRegex.exec(html)) !== null) {
      const url = match[1].replace(/236x/g, '736x').replace(/60x60/g, '736x');
      images.add(url);
    }

    const imgList = Array.from(images);
    if (imgList.length === 0) return { ok: false, msg: 'Nenhuma imagem encontrada' };

    const result = {
      criador: 'Hiudy',
      type: 'image',
      urls: imgList.slice(0, 50)
    };

    setCache(\`search:\${query.toLowerCase()}\`, result);
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, msg: 'Erro ao buscar no Pinterest' };
  }
}

async function dl(url) {
  try {
    const cached = getCached(\`download:\${url}\`);
    if (cached) return { ok: true, ...cached, cached: true };

    const response = await axios.get(url, { headers: HEADERS, timeout: 30000 });
    const html = response.data;

    // Extração via OG Tags (Mais confiável para vídeos e imagens principais)
    const ogVideo = html.match(/property="og:video" content="([^"]+)"/);
    const ogImage = html.match(/property="og:image" content="([^"]+)"/);
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);

    let mediaUrl = null;
    let type = 'image';

    if (ogVideo) {
      mediaUrl = ogVideo[1];
      type = 'video';
    } else if (ogImage) {
      mediaUrl = ogImage[1];
      // Tentar pegar a versão original da imagem se possível
      mediaUrl = mediaUrl.replace(/736x/g, 'originals').replace(/236x/g, 'originals');
    } else {
      // Fallback: procurar qualquer link de imagem original no HTML
      const imgMatch = html.match(/https:\/\/i\.pinimg\.com\/originals\/[^"]+/);
      if (imgMatch) mediaUrl = imgMatch[0];
    }

    if (!mediaUrl) return { ok: false, msg: 'Não foi possível encontrar a mídia neste link' };

    const result = {
      criador: 'Hiudy',
      type: type,
      mime: type === 'video' ? 'video/mp4' : 'image/jpeg',
      title: titleMatch ? titleMatch[1].replace(' | Pinterest', '').trim() : 'Pinterest Download',
      urls: [mediaUrl]
    };

    setCache(\`download:\${url}\`, result);
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, msg: 'Erro ao baixar do Pinterest' };
  }
}

export { search, dl };
