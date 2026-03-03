
// Comando: /tmctt (Transmitir para Contatos)
// Envia uma mensagem para todos os contatos salvos na lista do bot.

import { loadContacts } from './svctt.js';

/**
 * Envia uma mensagem para uma lista de contatos.
 */
async function broadcastMessage(sock, contactJids, messageContent, originalMessage) {
    let successCount = 0;
    let failCount = 0;
    const failedJids = [];

    for (const jid of contactJids) {
        try {
            await sock.sendMessage(jid, messageContent, { quoted: originalMessage });
            successCount++;
            // Pausa para evitar bloqueio por spam
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
        } catch (error) {
            console.error(`[tmctt] Falha ao enviar para ${jid}:`, error.message);
            failCount++;
            failedJids.push(jid);
        }
    }

    return { successCount, failCount, failedJids };
}

/**
 * Função principal para ser chamada pelo bot.
 */
export async function handleBroadcast(sock, message) {
    const { remoteJid } = message.key;
    const quotedMsg = message.message.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quotedMsg) {
        await sock.sendMessage(remoteJid, { text: '⚠️ Por favor, responda à mensagem que você deseja transmitir com o comando /tmctt.' }, { quoted: message });
        return;
    }

    const { contacts, stats } = loadContacts();

    if (!contacts || contacts.length === 0) {
        await sock.sendMessage(remoteJid, { text: '⚠️ Nenhum contato salvo para transmitir. Use o comando /svctt para adicionar contatos primeiro.' }, { quoted: message });
        return;
    }

    const contactJids = contacts.map(c => c.id);

    await sock.sendMessage(remoteJid, { text: `🚀 Iniciando transmissão para ${stats.totalContacts} contato(s)...` }, { quoted: message });

    // Prepara a mensagem a ser encaminhada
    const messageContent = {
        forward: {
            key: {
                remoteJid: message.message.extendedTextMessage.contextInfo.participant,
                id: message.message.extendedTextMessage.contextInfo.stanzaId
            },
            message: quotedMsg
        }
    };

    const result = await broadcastMessage(sock, contactJids, messageContent, message);

    let report = `✅ Transmissão concluída!\n\n`;
    report += `📤 Enviadas: ${result.successCount}\n`;
    report += `❌ Falhas: ${result.failCount}\n`;

    if (result.failCount > 0) {
        report += `\nJIDs com falha:\n${result.failedJids.join('\n')}`;
    }

    await sock.sendMessage(remoteJid, { text: report }, { quoted: message });
}
