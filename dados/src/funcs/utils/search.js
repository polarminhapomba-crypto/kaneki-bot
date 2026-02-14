/**
 * Search Service - Implementação usando Google Suggest e Google Images
 * Esta versão foca em estabilidade, velocidade e suporte a caracteres especiais.
 */

import { apiClient, scrapingClient } from '../../utils/httpClient.js';

// Cache simples
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutos

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
 * Pesquisar no Google (via Sugestões e Links Diretos)
 * @param {string} query - Termo de pesquisa
 * @param {number} maxResults - Número máximo de resultados
 * @returns {Promise<Object>} Resultados da pesquisa
 */
async function search(query, maxResults = 5) {
  try {
    if (!query || query.trim().length === 0) {
      return { ok: false, msg: 'Termo de pesquisa inválido' };
    }

    // Verificar cache
    const cached = getCached(`search:${query}:${maxResults}`);
    if (cached) return { ok: true, ...cached, cached: true };

    console.log(`[Search] Pesquisando: "${query}"`);

    // Usar o endpoint de sugestões do Google que retorna títulos relevantes
    const suggestUrl = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
    const suggestResponse = await apiClient.get(suggestUrl, { 
        timeout: 10000,
        responseType: 'arraybuffer'
    });
    
    // Decodificar manualmente o buffer para evitar problemas de encoding
    const decoder = new TextDecoder('latin1');
    const decodedData = decoder.decode(suggestResponse.data);
    const data = JSON.parse(decodedData);
    const suggestions = data[1] || [];

    const results = suggestions.slice(0, maxResults).map((title, index) => ({
        position: index + 1,
        title: title,
        url: `https://www.google.com/search?q=${encodeURIComponent(title)}`,
        description: `Pesquisa relacionada a: ${title}`,
        displayUrl: 'www.google.com'
    }));

    const result = {
      query,
      totalResults: results.length,
      results
    };

    if (results.length > 0) {
        setCache(`search:${query}:${maxResults}`, result);
        return { ok: true, ...result };
    } else {
        return { ok: false, msg: 'Nenhum resultado encontrado.' };
    }
    
  } catch (error) {
    console.error('[Search] Erro:', error.message);
    return { ok: false, msg: 'Erro ao realizar pesquisa.' };
  }
}

/**
 * Pesquisar imagens no Google
 * @param {string} query - Termo de pesquisa
 * @returns {Promise<string[]>} URLs das imagens
 */
async function searchImages(query) {
  try {
    // Usar o endpoint de busca de imagens com User-Agent de bot para evitar bloqueios complexos
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&hl=pt-BR`;
    const response = await scrapingClient.get(url, {
      headers: { 
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' 
      }
    });

    const html = response.data;
    const images = [];
    
    // No HTML básico de imagens, as imagens estão em tags <img> com src
    const regex = /<img[^>]+src="([^"]+)"[^>]+>/g;
    let match;
    while ((match = regex.exec(html)) !== null && images.length < 10) {
        const src = match[1];
        if (src.startsWith('http') && !src.includes('googlelogo')) {
            images.push(src);
        }
    }

    return images;
  } catch (error) {
    console.error('[Search] Erro ao buscar imagens:', error.message);
    return [];
  }
}

/**
 * Pesquisar notícias
 * @param {string} query - Termo de pesquisa
 * @param {number} maxResults - Número máximo de resultados
 * @returns {Promise<Object>} Resultados da pesquisa
 */
async function searchNews(query, maxResults = 5) {
    return search(query, maxResults);
}

export default { search, searchNews, searchImages };
export { search, searchNews, searchImages };
