import axios from 'axios';

const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.MANUS_TIMEOUT_MS || '120000', 10);
const DEFAULT_MODEL = process.env.OPENMANUS_FALLBACK_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const DEFAULT_SYSTEM_PROMPT = `Você é o Manus operando dentro de um bot do WhatsApp.
Responda em português do Brasil, de forma útil, direta e organizada.
Quando a tarefa exigir capacidades externas não conectadas nesta instância do bot, explique a limitação de forma breve e proponha a melhor alternativa.
Evite enrolação, mas mantenha contexto suficiente para a resposta ficar realmente útil.`;

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function getMessageText(msg) {
    if (!msg?.message || typeof msg.message !== 'object') return '';

    const directText = [
        msg.message.conversation,
        msg.message.extendedTextMessage?.text,
        msg.message.imageMessage?.caption,
        msg.message.videoMessage?.caption,
        msg.message.documentMessage?.caption,
        msg.message.buttonsResponseMessage?.selectedButtonId,
        msg.message.listResponseMessage?.singleSelectReply?.selectedRowId,
        msg.message.templateButtonReplyMessage?.selectedId,
        msg.message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson,
    ].find((value) => typeof value === 'string' && value.trim());

    if (directText) return directText.trim();

    if (msg.message.ephemeralMessage?.message) {
        return getMessageText({ message: msg.message.ephemeralMessage.message });
    }

    if (msg.message.viewOnceMessage?.message) {
        return getMessageText({ message: msg.message.viewOnceMessage.message });
    }

    if (msg.message.viewOnceMessageV2?.message) {
        return getMessageText({ message: msg.message.viewOnceMessageV2.message });
    }

    return '';
}

function extractQuotedText(msg) {
    const quoted = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted || typeof quoted !== 'object') return '';

    return getMessageText({ message: quoted });
}

function extractCommandPayload(text, prefix = '/') {
    const normalizedPrefix = normalizeText(prefix) || '/';
    const normalizedText = normalizeText(text);

    if (!normalizedText) return null;
    if (!normalizedText.toLowerCase().startsWith(`${normalizedPrefix}manus`)) return null;

    const payload = normalizedText.slice(`${normalizedPrefix}manus`.length).trim();
    return payload;
}

function pickResponseText(data) {
    if (!data) return '';
    if (typeof data === 'string') return data.trim();

    const candidates = [
        data.reply,
        data.response,
        data.result,
        data.output,
        data.text,
        data.message,
        data.content,
        data.data?.reply,
        data.data?.response,
        data.data?.result,
        data.data?.output,
        data.data?.text,
        data.data?.message,
        data.data?.content,
        data.choices?.[0]?.message?.content,
    ];

    const firstText = candidates.find((value) => typeof value === 'string' && value.trim());
    return firstText ? firstText.trim() : '';
}

async function callOpenManusBridge(prompt, metadata = {}) {
    const bridgeUrl = normalizeText(process.env.OPENMANUS_BRIDGE_URL);
    if (!bridgeUrl) return null;

    const response = await axios.post(
        bridgeUrl,
        {
            prompt,
            metadata,
            source: 'whatsapp-bot',
        },
        {
            timeout: DEFAULT_TIMEOUT_MS,
            headers: {
                'Content-Type': 'application/json',
                ...(process.env.OPENMANUS_API_KEY
                    ? { Authorization: `Bearer ${process.env.OPENMANUS_API_KEY}` }
                    : {}),
            },
        },
    );

    const text = pickResponseText(response.data);
    if (!text) {
        throw new Error('A ponte OpenManus respondeu sem texto útil.');
    }

    return {
        provider: 'openmanus-bridge',
        text,
    };
}

async function callOpenAiCompatibleFallback(prompt, metadata = {}) {
    const apiKey = normalizeText(process.env.OPENAI_API_KEY);
    const baseUrl = normalizeText(process.env.OPENAI_BASE_URL) || 'https://api.openai.com/v1';

    if (!apiKey) {
        throw new Error('Nenhuma credencial configurada para OpenManus nem fallback compatível com OpenAI.');
    }

    const response = await axios.post(
        `${baseUrl.replace(/\/$/, '')}/chat/completions`,
        {
            model: DEFAULT_MODEL,
            temperature: 0.4,
            messages: [
                {
                    role: 'system',
                    content: DEFAULT_SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            metadata,
        },
        {
            timeout: DEFAULT_TIMEOUT_MS,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
        },
    );

    const text = pickResponseText(response.data);
    if (!text) {
        throw new Error('O fallback compatível com OpenAI respondeu sem conteúdo textual.');
    }

    return {
        provider: 'openai-compatible',
        text,
    };
}

function buildUsage(prefix = '/') {
    return [
        '🤖 *Modo Manus*',
        '',
        `Use: ${prefix}manus <pedido>`,
        '',
        'Exemplos:',
        `• ${prefix}manus resuma esta notícia em 5 linhas`,
        `• ${prefix}manus crie uma estratégia de vendas para minha loja`,
        `• ${prefix}manus explique este erro de programação`,
    ].join('\n');
}

function truncateForWhatsApp(text, maxLength = 3500) {
    if (!text || text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 20).trim()}\n\n[resposta truncada]`;
}

export async function runManusPrompt({ prompt, metadata = {} }) {
    const cleanPrompt = normalizeText(prompt);
    if (!cleanPrompt) {
        throw new Error('Prompt vazio.');
    }

    try {
        const bridgeResult = await callOpenManusBridge(cleanPrompt, metadata);
        if (bridgeResult) return bridgeResult;
    } catch (error) {
        console.warn('[MANUS] Falha na ponte OpenManus, usando fallback quando disponível:', error.message);
    }

    return await callOpenAiCompatibleFallback(cleanPrompt, metadata);
}

export async function maybeHandleManusCommand({ sock, msg, prefix = '/', botName = 'Bot' }) {
    const rawText = getMessageText(msg);
    const payload = extractCommandPayload(rawText, prefix);

    if (payload === null) return false;

    const remoteJid = msg?.key?.remoteJid;
    if (!remoteJid || !sock?.sendMessage) return true;

    const quotedText = extractQuotedText(msg);
    const finalPrompt = normalizeText(payload || quotedText);

    if (!finalPrompt) {
        await sock.sendMessage(
            remoteJid,
            { text: buildUsage(prefix) },
            { quoted: msg },
        );
        return true;
    }

    await sock.sendMessage(
        remoteJid,
        { text: '⏳ *Manus:* processando seu pedido...' },
        { quoted: msg },
    );

    try {
        const result = await runManusPrompt({
            prompt: finalPrompt,
            metadata: {
                botName,
                remoteJid,
                senderJid: msg?.key?.participant || msg?.key?.remoteJid || '',
                messageId: msg?.key?.id || '',
            },
        });

        const providerLabel = result.provider === 'openmanus-bridge' ? 'OpenManus' : 'Assistente Manus';
        const finalText = truncateForWhatsApp(result.text);

        await sock.sendMessage(
            remoteJid,
            { text: `🤖 *${providerLabel}*\n\n${finalText}` },
            { quoted: msg },
        );
    } catch (error) {
        console.error('[MANUS] Erro ao processar /manus:', error.message);

        let friendlyMessage = '❌ Não consegui executar o comando /manus agora.';

        if (String(error.message || '').toLowerCase().includes('credencial')) {
            friendlyMessage += '\n\nConfigure no servidor pelo menos uma destas opções:';
            friendlyMessage += '\n• OPENMANUS_BRIDGE_URL (+ OPENMANUS_API_KEY se necessário)';
            friendlyMessage += '\n• OPENAI_API_KEY (+ OPENAI_BASE_URL opcional)';
        } else {
            friendlyMessage += `\n\nDetalhe: ${error.message}`;
        }

        await sock.sendMessage(
            remoteJid,
            { text: friendlyMessage },
            { quoted: msg },
        );
    }

    return true;
}

export default {
    getMessageText,
    extractCommandPayload,
    runManusPrompt,
    maybeHandleManusCommand,
};
