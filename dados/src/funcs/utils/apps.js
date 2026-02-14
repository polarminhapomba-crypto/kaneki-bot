/**
 * Apps Search Service - Busca aplicativos na Play Store e App Store
 */

import axios from 'axios';
import { parseHTML } from 'linkedom';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Busca na Google Play Store
 * @param {string} query - Nome do app
 * @returns {Promise<Object|null>}
 */
async function searchPlayStore(query) {
    const url = `https://play.google.com/store/search?q=${encodeURIComponent(query)}&c=apps&hl=pt-BR`;
    try {
        const response = await axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 10000 });
        const { document } = parseHTML(response.data);
        
        const appLink = document.querySelector('a[href*="/store/apps/details"]');
        if (appLink) {
            const title = appLink.querySelector('span')?.textContent || query;
            const href = 'https://play.google.com' + appLink.getAttribute('href');
            
            // Tentar pegar uma imagem melhor
            let img = '';
            const imgEl = appLink.closest('div')?.querySelector('img');
            if (imgEl) {
                img = imgEl.getAttribute('srcset')?.split(' ')[0] || imgEl.getAttribute('src') || '';
            }
            
            return { title, url: href, img };
        }
    } catch (e) {
        console.error('[Apps] Erro Play Store:', e.message);
    }
    return null;
}

/**
 * Busca na Apple App Store
 * @param {string} query - Nome do app
 * @returns {Promise<Object|null>}
 */
async function searchAppStore(query) {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=br&entity=software&limit=1`;
    try {
        const response = await axios.get(url, { timeout: 10000 });
        const data = response.data;
        if (data.results && data.results.length > 0) {
            const app = data.results[0];
            return {
                title: app.trackName,
                url: app.trackViewUrl,
                img: app.artworkUrl100.replace('100x100', '512x512') // Tentar imagem maior
            };
        }
    } catch (e) {
        console.error('[Apps] Erro App Store:', e.message);
    }
    return null;
}

/**
 * Busca em ambas as lojas
 * @param {string} query - Nome do app
 * @returns {Promise<Object>}
 */
async function searchApps(query) {
    const [playStore, appStore] = await Promise.all([
        searchPlayStore(query),
        searchAppStore(query)
    ]);

    return {
        query,
        playStore,
        appStore,
        ok: !!(playStore || appStore)
    };
}

export { searchApps };
export default { searchApps };
