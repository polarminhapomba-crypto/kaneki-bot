/**
 * Módulo de integração com Manus
 * Fornece funcionalidades leves para o comando /manus
 */

import axios from 'axios';

const MANUS_API_BASE = 'https://api.manus.ai';
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

        // Envia requisição para Manus (API v1 tasks)
        const response = await axios.post(
            `${MANUS_API_BASE}/v1/tasks`,
            {
                prompt: commandText,
                agentProfile: 'manus-1.6-lite' // Perfil leve para bot de WhatsApp
            },
            {
                timeout: REQUEST_TIMEOUT,
                headers: {
                    'Content-Type': 'application/json',
                    'API_KEY': process.env.MANUS_API_KEY || '', // Requer chave de API
                    'User-Agent': 'Kaneki-Bot/1.0'
                }
            }
        );

        // Processa resposta
        if (response.data && response.data.task_id) {
            return `✅ Tarefa criada no Manus!\n\n🆔 ID: ${response.data.task_id}\n🔗 Acompanhe em: ${response.data.task_url || response.data.share_url || 'Link não disponível'}`;
        } else {
            return '❌ Resposta inválida do Manus (ID da tarefa não encontrado)';
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
