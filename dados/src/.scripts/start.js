#!/usr/bin/env node

import http from 'http';

// Inicia o Healthcheck IMEDIATAMENTE para o Railway não derrubar o bot
const isCloud = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_NAME || process.env.DYNO || process.env.RENDER || process.env.FLY_APP_NAME);
if (isCloud) {
  const port = process.env.PORT || 8080;
  http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
  }).listen(port, '0.0.0.0', () => {
    console.log(`🌐 [Railway] Healthcheck ultra-precoce ativo na porta ${port}`);
  });
}

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import readline from 'readline/promises';
import os from 'os';

const CONFIG_PATH = path.join(process.cwd(), 'dados', 'src', 'config.json');
const NODE_MODULES_PATH = path.join(process.cwd(), 'node_modules');
const QR_CODE_DIR = path.join(process.cwd(), 'dados', 'database', 'qr-code');
const CONNECT_FILE = path.join(process.cwd(), 'dados', 'src', 'connect.js');
const isWindows = os.platform() === 'win32';
const isTermux = fsSync.existsSync('/data/data/com.termux');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[1;32m',
  red: '\x1b[1;31m',
  blue: '\x1b[1;34m',
  yellow: '\x1b[1;33m',
  cyan: '\x1b[1;36m',
  bold: '\x1b[1m',
};

const mensagem = (text) => console.log(`${colors.green}${text}${colors.reset}`);
const aviso = (text) => console.log(`${colors.red}${text}${colors.reset}`);
const info = (text) => console.log(`${colors.cyan}${text}${colors.reset}`);
const separador = () => console.log(`${colors.blue}============================================${colors.reset}`);

const getVersion = () => {
  try {
    const packageJson = JSON.parse(fsSync.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    return packageJson.version || 'Desconhecida';
  } catch {
    return 'Desconhecida';
  }
};

let botProcess = null;
const version = getVersion();

async function setupTermuxAutostart() {
  if (!isTermux) {
    info('📱 Não está rodando no Termux. Ignorando configuração de autostart.');
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await rl.question(`${colors.yellow}📱 Detectado ambiente Termux. Deseja configurar inicialização automática? (s/n): ${colors.reset}`);
  rl.close();

  if (answer.trim().toLowerCase() !== 's') {
    info('📱 Configuração de autostart ignorada pelo usuário.');
    return;
  }

  info('📱 Configurando inicialização automática no Termux...');

  try {
    const termuxProperties = path.join(process.env.HOME, '.termux', 'termux.properties');
    await fs.mkdir(path.dirname(termuxProperties), { recursive: true });
    if (!fsSync.existsSync(termuxProperties)) {
      await fs.writeFile(termuxProperties, '');
    }
    execSync(`sed '/^# *allow-external-apps *= *true/s/^# *//' ${termuxProperties} -i && termux-reload-settings`, { stdio: 'inherit' });
    mensagem('📝 Configuração de termux.properties concluída.');

    const bashrcPath = path.join(process.env.HOME, '.bashrc');
    const termuxServiceCommand = `
am startservice --user 0 \\
  -n com.termux/com.termux.app.RunCommandService \\
  -a com.termux.RUN_COMMAND \\
  --es com.termux.RUN_COMMAND_PATH '/data/data/com.termux/files/usr/bin/npm' \\
  --esa com.termux.RUN_COMMAND_ARGUMENTS 'start' \\
  --es com.termux.RUN_COMMAND_SESSION_NAME 'Toji Bot' \\
  --es com.termux.RUN_COMMAND_WORKDIR '${path.join(process.cwd())}' \\
  --ez com.termux.RUN_COMMAND_BACKGROUND 'false' \\
  --es com.termux.RUN_COMMAND_SESSION_ACTION '0'
`.trim();

    let bashrcContent = '';
    if (fsSync.existsSync(bashrcPath)) {
      bashrcContent = await fs.readFile(bashrcPath, 'utf8');
    }

    if (!bashrcContent.includes(termuxServiceCommand)) {
      await fs.appendFile(bashrcPath, `\n${termuxServiceCommand}\n`);
      mensagem('📝 Comando am startservice adicionado ao ~/.bashrc');
    } else {
      info('📝 Comando am startservice já presente no ~/.bashrc');
    }

    mensagem('📱 Configuração de inicialização automática no Termux concluída!');
  } catch (error) {
    aviso(`❌ Erro ao configurar autostart no Termux: ${error.message}`);
  }
}

function setupGracefulShutdown() {
  const shutdown = () => {
    mensagem('🛑 Encerrando o Toji... Até logo!');
    if (botProcess) {
      botProcess.removeAllListeners();
      botProcess.kill();
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (isWindows) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.on('SIGINT', shutdown);
  }
}

async function displayHeader() {
  const header = [
    `${colors.bold}🚀 Toji - Conexão WhatsApp${colors.reset}`,
    `${colors.bold}📦 Versão: ${version}${colors.reset}`,
  ];

  separador();
  for (const line of header) {
    console.log(line);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  separador();
  console.log();
}

async function checkPrerequisites() {
  if (!fsSync.existsSync(CONFIG_PATH)) {
    aviso('⚠️ Arquivo de configuração (config.json) não encontrado! Iniciando configuração automática...');
    try {
      await new Promise((resolve, reject) => {
        const configProcess = spawn('npm', ['run', 'config'], { stdio: 'inherit', shell: isWindows });
        configProcess.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Configuração falhou com código ${code}`))));
        configProcess.on('error', reject);
      });
      mensagem('📝 Configuração concluída com sucesso!');
    } catch (error) {
      aviso(`❌ Falha na configuração: ${error.message}`);
      mensagem('📝 Tente executar manualmente: npm run config');
      process.exit(1);
    }
  }

  if (!fsSync.existsSync(NODE_MODULES_PATH)) {
    aviso('⚠️ Módulos do Node.js não encontrados! Iniciando instalação automática...');
    try {
      await new Promise((resolve, reject) => {
        const installProcess = spawn('npm', ['run', 'config:install'], { stdio: 'inherit', shell: isWindows });
        installProcess.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Instalação falhou com código ${code}`))));
        installProcess.on('error', reject);
      });
      mensagem('📦 Instalação dos módulos concluída com sucesso!');
    } catch (error) {
      aviso(`❌ Falha na instalação dos módulos: ${error.message}`);
      mensagem('📦 Tente executar manualmente: npm run config:install');
      process.exit(1);
    }
  }

  if (!fsSync.existsSync(CONNECT_FILE)) {
    aviso(`⚠️ Arquivo de conexão (${CONNECT_FILE}) não encontrado!`);
    aviso('🔍 Verifique a instalação do projeto.');
    process.exit(1);
  }
}

function startBot(codeMode = false) {
  // Otimização para 1GB de RAM (Railway/Termux)
  const args = [
    '--expose-gc',
    '--max-old-space-size=768', // Limita a 768MB para deixar margem pro sistema
    '--gc-interval=100',        // Coleta lixo com mais frequência
    CONNECT_FILE
  ];
  
  if (codeMode) args.push('--code');

  info(`📷 Iniciando com ${codeMode ? 'código de pareamento' : 'QR Code'} (Otimizado para 1GB RAM)`);

  botProcess = spawn('node', args, {
    stdio: 'inherit',
    env: { 
      ...process.env, 
      FORCE_COLOR: '1',
      NODE_ENV: 'production',
      UV_THREADPOOL_SIZE: '4' // Reduz threads para economizar memória
    },
  });

  botProcess.on('error', (error) => {
    aviso(`❌ Erro ao iniciar o processo do bot: ${error.message}`);
    restartBot(codeMode);
  });

  botProcess.on('close', (code) => {
    if (code === 0) {
      info(`✅ O bot terminou normalmente (código: ${code}). Reiniciando...`);
    } else {
      aviso(`⚠️ O bot terminou com erro (código: ${code}). Reiniciando...`);
    }
    restartBot(codeMode);
  });

  return botProcess;
}

function restartBot(codeMode) {
  const delay = isCloud ? 15000 : 500;
  aviso(`🔄 Reiniciando o bot em ${delay}ms...`);
  setTimeout(() => {
    if (botProcess) botProcess.removeAllListeners();
    startBot(codeMode);
  }, delay);
}

async function checkAutoConnect() {
  try {
    if (!fsSync.existsSync(QR_CODE_DIR)) {
      await fs.mkdir(QR_CODE_DIR, { recursive: true });
      return false;
    }
    const files = await fs.readdir(QR_CODE_DIR);
    return files.length > 2;
  } catch (error) {
    aviso(`❌ Erro ao verificar diretório de QR Code: ${error.message}`);
    return false;
  }
}

async function promptConnectionMethod() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`${colors.yellow}🔧 Escolha o método de conexão:${colors.reset}`);
  console.log(`${colors.yellow}1. 📷 Conectar via QR Code${colors.reset}`);
  console.log(`${colors.yellow}2. 🔑 Conectar via código de pareamento${colors.reset}`);
  console.log(`${colors.yellow}3. 🚪 Sair${colors.reset}`);

  const answer = await rl.question('➡️ Digite o número da opção desejada: ');
  console.log();
  rl.close();

  switch (answer.trim()) {
    case '1':
      mensagem('📷 Iniciando conexão via QR Code...');
      return { method: 'qr' };
    case '2':
      mensagem('🔑 Iniciando conexão via código de pareamento...');
      // Limpa a sessão antiga para garantir que um novo código seja gerado
      if (fsSync.existsSync(QR_CODE_DIR)) {
        fsSync.readdirSync(QR_CODE_DIR).forEach(file => {
          fsSync.rmSync(path.join(QR_CODE_DIR, file), { recursive: true, force: true });
        });
      }
      return { method: 'code' };
    case '3':
      mensagem('👋 Encerrando... Até mais!');
      process.exit(0);
    default:
      aviso('⚠️ Opção inválida! Usando conexão via QR Code como padrão.');
      return { method: 'qr' };
  }
}

async function main() {
  try {
    setupGracefulShutdown();
    await displayHeader();
    await checkPrerequisites();

    if (!isCloud) {
      await setupTermuxAutostart();
    }

    const hasSession = await checkAutoConnect();
    if (hasSession) {
      mensagem('📷 Sessão de QR Code detectada. Conectando automaticamente...');
      startBot(false);
    } else if (isCloud) {
      mensagem('☁️ Ambiente de nuvem detectado. Iniciando bot automaticamente...');
      startBot(true); 
    } else {
      const { method } = await promptConnectionMethod();
      startBot(method === 'code');
    }

    if (isCloud) {
      setInterval(() => {}, 1000 * 60 * 60); 
    }
  } catch (error) {
    aviso(`❌ Erro inesperado: ${error.message}`);
    process.exit(1);
  }
}

(async () => {
  await main();
})();