// --- SISTEMA DE TRANSMISSÃO INTEGRADO (BROADCAST & CONTACTS) ---
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRANSMISSAO_FILE = path.join(__dirname, '../../../database/transmissao.json');

/**
 * Carrega a lista de inscritos/contatos
 */
const loadSubscribers = () => {
    try {
        if (fs.existsSync(TRANSMISSAO_FILE)) {
            const data = JSON.parse(fs.readFileSync(TRANSMISSAO_FILE, 'utf8'));
            return data;
        }
        return {
            subscribers: [],
            stats: {
                totalSubscribers: 0,
                totalMessages: 0,
                lastBroadcast: null
            }
        };
    } catch (err) {
        console.error('[TRANSMISSAO] Erro ao carregar inscritos:', err.message);
        return {
            subscribers: [],
            stats: {
                totalSubscribers: 0,
                totalMessages: 0,
                lastBroadcast: null
            }
        };
    }
};

/**
 * Salva a lista de inscritos/contatos
 */
const saveSubscribers = (data) => {
    try {
        const dir = path.dirname(TRANSMISSAO_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(TRANSMISSAO_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error('[TRANSMISSAO] Erro ao salvar inscritos:', err.message);
        return false;
    }
};

/**
 * Função para o comando /svctt (Salvar Contato)
 */
export async function handleSaveContact(sock, message, text) {
    const { remoteJid } = message.key;
    const [number, ...nameParts] = text.split(' ');
    const name = nameParts.join(' ').trim();

    if (!number) {
        await sock.sendMessage(remoteJid, { text: '⚠️ Uso: /svctt <número> [nome]' }, { quoted: message });
        return;
    }

    const cleanNumber = number.replace(/\D/g, '');
    const userId = `${cleanNumber}@s.whatsapp.net`;
    
    const data = loadSubscribers();
    const alreadyExists = data.subscribers.some(sub => sub.id === userId);

    if (alreadyExists) {
        await sock.sendMessage(remoteJid, { text: '⚠️ Este contato já está salvo!' }, { quoted: message });
        return;
    }

    data.subscribers.push({
        id: userId,
        name: name || cleanNumber,
        subscribedAt: new Date().toISOString(),
        messagesReceived: 0
    });

    data.stats.totalSubscribers = data.subscribers.length;

    if (saveSubscribers(data)) {
        await sock.sendMessage(remoteJid, { text: `✅ Contato ${name || cleanNumber} salvo com sucesso!` }, { quoted: message });
    }
}

/**
 * Função para o comando /tmctt (Transmissão em Massa - Foco no Privado)
 */
export async function handleBroadcast(sock, message) {
    const { remoteJid } = message.key;
    
    // Pega a mensagem citada (quoted) para transmitir
    const quotedMsg = message.message.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quotedMsg) {
        await sock.sendMessage(remoteJid, { text: '⚠️ Responda a uma mensagem com /tmctt para transmitir para todos os contatos.' }, { quoted: message });
        return;
    }

    const data = loadSubscribers();
    if (data.subscribers.length === 0) {
        await sock.sendMessage(remoteJid, { text: '⚠️ Nenhum contato salvo na lista. Use /svctt primeiro.' }, { quoted: message });
        return;
    }

    await sock.sendMessage(remoteJid, { text: `🚀 Iniciando transmissão privada para ${data.subscribers.length} contatos...` }, { quoted: message });

    let success = 0;
    let failed = 0;

    // Prepara o conteúdo da mensagem para encaminhamento
    const messageContent = {
        forward: {
            key: {
                remoteJid: message.message.extendedTextMessage.contextInfo.participant,
                id: message.message.extendedTextMessage.contextInfo.stanzaId
            },
            message: quotedMsg
        }
    };

    // Loop de envio para cada contato salvo
    for (const sub of data.subscribers) {
        try {
            // Envia para o privado do contato
            await sock.sendMessage(sub.id, messageContent);
            success++;
            
            // Delay anti-ban (entre 1.5 e 3 segundos)
            await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500)); 
        } catch (e) {
            console.error(`[tmctt] Erro ao enviar para ${sub.id}:`, e.message);
            failed++;
        }
    }

    // Atualiza estatísticas
    data.stats.totalMessages += success;
    data.stats.lastBroadcast = new Date().toISOString();
    saveSubscribers(data);

    const report = `✅ *Transmissão Concluída!*\n\n` +
                   `📤 Enviadas: ${success}\n` +
                   `❌ Falhas: ${failed}\n` +
                   `👥 Total na lista: ${data.subscribers.length}`;

    await sock.sendMessage(remoteJid, { text: report }, { quoted: message });
}

// --- Funções Originais Mantidas para Compatibilidade ---
export const subscribe = (userId, userName) => {
    const data = loadSubscribers();
    if (data.subscribers.some(sub => sub.id === userId)) return { success: false, message: 'Já inscrito!' };
    data.subscribers.push({ id: userId, name: userName || 'Usuário', subscribedAt: new Date().toISOString(), messagesReceived: 0 });
    data.stats.totalSubscribers = data.subscribers.length;
    saveSubscribers(data);
    return { success: true, message: 'Inscrito com sucesso!' };
};

export const unsubscribe = (userId) => {
    const data = loadSubscribers();
    data.subscribers = data.subscribers.filter(sub => sub.id !== userId);
    data.stats.totalSubscribers = data.subscribers.length;
    saveSubscribers(data);
    return { success: true, message: 'Cancelado com sucesso!' };
};

export const isSubscribed = (userId) => loadSubscribers().subscribers.some(sub => sub.id === userId);
export const getSubscribers = () => loadSubscribers().subscribers;
export const getStats = () => {
    const data = loadSubscribers();
    return { totalSubscribers: data.stats.totalSubscribers, totalMessages: data.stats.totalMessages, lastBroadcast: data.stats.lastBroadcast, subscribers: data.subscribers };
};
export const incrementMessageCount = (count) => {
    const data = loadSubscribers();
    data.stats.totalMessages += count;
    saveSubscribers(data);
};
export const removeSubscriber = (userId) => unsubscribe(userId);
export const clearAll = () => {
    const data = loadSubscribers();
    data.subscribers = [];
    data.stats.totalSubscribers = 0;
    saveSubscribers(data);
    return { success: true };
};
