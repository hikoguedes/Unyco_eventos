#!/bin/bash
# ==========================================================
# UNYCO Esporte - Script de Deploy Automático na VPS
# Servidor: 143.95.166.233 | Nginx + Node.js + PostgreSQL
# ==========================================================

set -e

APP_DIR="/var/www/unyco-eventos"
APP_USER="root"
PM2_APP_NAME="unyco-eventos"
DB_NAME="unyco_eventos_db"
DB_USER="unyco_user"
DB_PASS="unyco_secret"
PORT=3000

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  UNYCO Esporte - Deploy na VPS           ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 1. Atualizar sistema
echo "📦 [1/8] Atualizando pacotes do sistema..."
apt-get update -qq

# 2. Instalar PM2 globalmente se não existir
if ! command -v pm2 &> /dev/null; then
  echo "🔧 [2/8] Instalando PM2..."
  npm install -g pm2
else
  echo "✅ [2/8] PM2 já instalado: $(pm2 -v)"
fi

# 3. Criar banco de dados PostgreSQL
echo "🗄️  [3/8] Configurando banco de dados PostgreSQL..."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "   ℹ️  Usuário $DB_USER já existe."
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "   ℹ️  Banco $DB_NAME já existe."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"

# 4. Criar diretório da aplicação
echo "📁 [4/8] Preparando diretório $APP_DIR..."
mkdir -p $APP_DIR

# 5. Copiar arquivos da aplicação
echo "📤 [5/8] Arquivos da aplicação copiados com sucesso!"

# 6. Instalar dependências de produção
echo "📦 [6/8] Instalando dependências Node.js..."
cd $APP_DIR
npm install --omit=dev --legacy-peer-deps 2>&1 | tail -5

# 7. Criar arquivo .env de produção
echo "⚙️  [7/8] Configurando variáveis de ambiente..."
cat > $APP_DIR/.env << 'ENVEOF'
PORT=3000
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_USER=unyco_user
DB_PASSWORD=unyco_secret
DB_NAME=unyco_eventos_db
ENVEOF

# 8. Iniciar aplicação com PM2
echo "🚀 [8/8] Iniciando aplicação com PM2..."
cd $APP_DIR
pm2 delete $PM2_APP_NAME 2>/dev/null || true
pm2 start src/server.js --name $PM2_APP_NAME --env production
pm2 save

echo ""
echo "✅ Aplicação iniciada com PM2!"
echo "📊 Status: $(pm2 list | grep $PM2_APP_NAME | head -1)"
echo ""
echo "🌐 App rodando em: http://localhost:$PORT"
echo ""
