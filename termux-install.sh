#!/bin/bash
# Script de instalação automatizada para Kaneki Bot no Termux
# Criado por Manus AI

echo "🚀 Iniciando instalação do Kaneki Bot no Termux..."

# 1. Atualizar pacotes
echo "📦 Atualizando pacotes do sistema..."
pkg update -y && pkg upgrade -y

# 2. Instalar dependências básicas
echo "🛠️ Instalando dependências (git, nodejs, ffmpeg, imagemagick)..."
pkg install git nodejs-lts ffmpeg imagemagick -y

# 3. Clonar o repositório na pasta HOME do Termux (IMPORTANTE: não usar /sdcard)
echo "📂 Clonando o repositório na pasta segura do Termux..."
cd $HOME
rm -rf kaneki-bot
git clone https://github.com/polarminhapomba-crypto/kaneki-bot.git
cd kaneki-bot

# 4. Instalar dependências do bot
echo "📥 Instalando dependências do bot (npm install)..."
npm install

# 5. Finalizar
echo "✅ Instalação concluída com sucesso!"
echo "👉 Para iniciar o bot, digite: npm start"
