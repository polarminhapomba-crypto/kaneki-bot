import http from 'http';

/**
 * Inicia um servidor HTTP simples para o healthcheck do Railway
 * Isso evita que o Railway encerre o processo por falta de resposta na porta
 */
export function startHealthCheck() {
    const port = process.env.PORT || 3000;
    
    const server = http.createServer((req, res) => {
        if (req.url === '/health' || req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            }));
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    server.listen(port, '0.0.0.0', () => {
        console.log(`🌐 Servidor de Healthcheck rodando na porta ${port}`);
    });

    // Tratamento de erros para não derrubar o bot
    server.on('error', (err) => {
        console.error('❌ Erro no servidor de Healthcheck:', err.message);
    });

    return server;
}
