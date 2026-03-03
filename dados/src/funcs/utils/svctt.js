
// Comando: /svctt (Salvar Contato)
// Salva um contato na lista do bot para futuras interações e transmissões.

import fs from 'fs';
import path from 'path';

// Define o caminho para o arquivo de contatos
const CONTACTS_FILE = path.join(process.env.DATABASE_PATH || './dados/database', 'saved_contacts.json');

/**
 * Carrega a lista de contatos salvos do arquivo JSON.
 * @returns {object} Objeto com a lista de contatos e estatísticas.
 */
const loadContacts = () => {
    try {
        if (fs.existsSync(CONTACTS_FILE)) {
            const data = fs.readFileSync(CONTACTS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[svctt] Erro ao carregar contatos:', error.message);
    }
    // Retorna uma estrutura padrão se o arquivo não existir ou der erro
    return { contacts: [], stats: { totalContacts: 0 } };
};

/**
 * Salva a lista de contatos no arquivo JSON.
 * @param {object} data - O objeto de contatos para salvar.
 * @returns {boolean} True se salvou com sucesso, false caso contrário.
 */
const saveContacts = (data) => {
    try {
        const dir = path.dirname(CONTACTS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CONTACTS_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('[svctt] Erro ao salvar contatos:', error.message);
        return false;
    }
};

/**
 * Adiciona ou atualiza um contato na lista.
 * @param {string} userId - O JID do usuário (ex: '5511999999999@s.whatsapp.net').
 * @param {string} [userName] - O nome para salvar o contato (opcional).
 * @returns {{success: boolean, message: string}} Objeto com status e mensagem.
 */
const addContact = (userId, userName) => {
    const contactsData = loadContacts();
    const existingContact = contactsData.contacts.find(c => c.id === userId);

    if (existingContact) {
        // Se o contato já existe, apenas informa
        return {
            success: false,
            message: `⚠️ Este contato já está salvo na lista com o nome "${existingContact.name}".`
        };
    }

    // Adiciona o novo contato
    contactsData.contacts.push({
        id: userId,
        name: userName || userId.split('@')[0], // Usa o número se o nome não for fornecido
        savedAt: new Date().toISOString()
    });

    contactsData.stats.totalContacts = contactsData.contacts.length;

    if (saveContacts(contactsData)) {
        return {
            success: true,
            message: `✅ Contato salvo com sucesso!\n\n👤 Nome: ${userName || userId.split('@')[0]}\n👥 Total de contatos: ${contactsData.stats.totalContacts}`
        };
    }

    return {
        success: false,
        message: '❌ Ocorreu um erro ao tentar salvar o contato.'
    };
};

/**
 * Função principal para ser chamada pelo bot.
 * @param {object} sock - A instância do socket Baileys.
 * @param {object} message - O objeto da mensagem recebida.
 * @param {string} text - O texto do comando (número e nome).
 */
async function handleSaveContact(sock, message, text) {
    const { remoteJid } = message.key;
    const [number, ...nameParts] = text.split(' ');
    const name = nameParts.join(' ').trim();

    if (!number) {
        await sock.sendMessage(remoteJid, { text: '⚠️ Por favor, forneça um número de telefone. Uso: /svctt <número> [nome]' }, { quoted: message });
        return;
    }

    // Limpa e formata o número para o padrão JID
    const cleanNumber = number.replace(/\D/g, '');
    const contactJid = `${cleanNumber}@s.whatsapp.net`;

    const result = addContact(contactJid, name);

    await sock.sendMessage(remoteJid, { text: result.message }, { quoted: message });
}

// Exporta as funções para serem usadas em outros lugares
export {
    handleSaveContact,
    loadContacts,
    saveContacts
};
