#!/bin/bash
# ==========================================================
# UNYCO Esporte - Script de Deploy / Atualização na VPS
# Servidor: 143.95.166.233 (Porta SSH: 22022) | Nginx + Node.js + PostgreSQL
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
echo "║  UNYCO Esporte - Deploy / Update na VPS  ║"
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

# 3. Criar e migrar banco de dados PostgreSQL
echo "🗄️  [3/8] Configurando banco de dados PostgreSQL..."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "   ℹ️  Usuário $DB_USER já existe."
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "   ℹ️  Banco $DB_NAME já existe."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"

# Aplicar migrações incrementais se a tabela inscricoes_evento já existir
sudo -u postgres psql $DB_NAME -c "ALTER TABLE inscricoes_evento ADD COLUMN IF NOT EXISTS parceiro_indicador_id INTEGER REFERENCES parceiros(id);" 2>/dev/null || true
sudo -u postgres psql $DB_NAME -c "ALTER TABLE inscricoes_evento ADD COLUMN IF NOT EXISTS origem_inscricao VARCHAR(50) DEFAULT 'ORGANICO';" 2>/dev/null || true

# 4. Criar diretório da aplicação e pastas de upload
echo "📁 [4/8] Preparando diretório $APP_DIR..."
mkdir -p $APP_DIR
mkdir -p $APP_DIR/public/uploads/partners
mkdir -p $APP_DIR/public/uploads/events
mkdir -p $APP_DIR/public/uploads/avatars

# 5. Atualizar arquivos da aplicação via Git
echo "📥 [5/8] Atualizando código via Git..."
cd $APP_DIR
if [ -d "$APP_DIR/.git" ]; then
  git fetch origin main
  git reset --hard origin/main
else
  echo "   Clonando repositório..."
  git clone https://github.com/hikoguedes/Unyco_eventos.git .
fi

# 6. Instalar dependências de produção
echo "📦 [6/8] Instalando dependências Node.js..."
cd $APP_DIR
npm install --omit=dev --legacy-peer-deps 2>&1 | tail -5

# 7. Criar / Atualizar arquivo .env de produção
echo "⚙️  [7/8] Configurando variáveis de ambiente..."
cat > $APP_DIR/.env << 'ENVEOF'
PORT=3000
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_USER=unyco_user
DB_PASSWORD=unyco_secret
DB_NAME=unyco_eventos_db
BASE_PATH=/unycoeventos
ENVEOF

# 8. Reiniciar aplicação com PM2
echo "🚀 [8/8] Reiniciando aplicação com PM2..."
cd $APP_DIR
pm2 delete $PM2_APP_NAME 2>/dev/null || true
pm2 start src/server.js --name $PM2_APP_NAME --env production
pm2 save

echo ""
echo "✅ Aplicação iniciada com sucesso no PM2!"
echo "📊 Status: $(pm2 list | grep $PM2_APP_NAME | head -1)"
echo ""
echo "🌐 App rodando em: http://localhost:$PORT"
echo "🌐 URL Pública: https://unycopass.com.br/unycoeventos/"
echo ""
