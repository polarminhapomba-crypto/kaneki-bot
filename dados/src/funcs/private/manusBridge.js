/**
 * Módulo de integração com Manus
 * Fornece funcionalidades leves para o comando /manus
 */

import axios from 'axios';

const MANUS_API_BASE = 'https://api.manus.im';
const REQUEST_TIMEOUT = 30000;

/**
 * Processa comando /manus
 * @param {string} userMessage - Mensagem do usuário
 * @param {object} socket - Socket do WhatsApp
 * @param {object} m - Objeto da mensagem
 * @returns {Promise<string>} Resposta do Manus
 */
export async function handleManusCommand(userMessage, socket, m) {
    try {
        // Extrai o texto do comando (remove /manus)
        const commandText = userMessage.replace(/^\/manus\s*/i, '').trim();
        
        if (!commandText) {
            return '❌ Use: /manus <seu pedido>\n\nExemplo: /manus gere uma imagem de um gato';
        }

        // Envia requisição para Manus
        const response = await axios.post(
            `${MANUS_API_BASE}/v1/process`,
            {
                prompt: commandText,
                context: {
                    platform: 'whatsapp',
                    userId: m.sender,
                    timestamp: new Date().toISOString()
                }
            },
            {
                timeout: REQUEST_TIMEOUT,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Kaneki-Bot/1.0'
                }
            }
        );

        // Processa resposta
        if (response.data && response.data.result) {
            return response.data.result;
        } else if (response.data && response.data.error) {
            return `❌ Erro do Manus: ${response.data.error}`;
        } else {
            return '❌ Resposta inválida do Manus';
        }

    } catch (error) {
        console.error('[MANUS] Erro ao processar comando:', error.message);
        
        if (error.code === 'ECONNABORTED') {
            return '⏱️ Timeout ao conectar com Manus. Tente novamente.';
        } else if (error.response?.status === 429) {
            return '⚠️ Limite de requisições atingido. Tente novamente em alguns segundos.';
        } else if (error.response?.status === 401) {
            return '❌ Erro de autenticação com Manus.';
        } else if (error.message.includes('ECONNREFUSED')) {
            return '❌ Não foi possível conectar com Manus. Tente novamente.';
        } else {
            return `❌ Erro ao processar comando: ${error.message}`;
        }
    }
}

/**
 * Verifica se uma mensagem é um comando /manus
 * @param {string} text - Texto da mensagem
 * @returns {boolean}
 */
export function isManusCommand(text) {
    return /^\/manus\b/i.test(text);
}

/**
 * Obtém informações sobre o comando /manus
 * @returns {object}
 */
export function getManusInfo() {
    return {
        command: '/manus',
        description: 'Integração com Manus para processamento de tarefas',
        usage: '/manus <seu pedido>',
        examples: [
            '/manus gere uma imagem de um gato',
            '/manus resuma este texto',
            '/manus traduza para inglês'
        ]
    };
}

export default {
    handleManusCommand,
    isManusCommand,
    getManusInfo
};
