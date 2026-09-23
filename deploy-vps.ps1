# ==========================================================
# UNYCO Esporte - Disparar Deploy na VPS via PowerShell
# Servidor: 143.95.166.233 (Porta SSH: 22022)
# ==========================================================

$ErrorActionPreference = "Stop"

$VPS_HOST = "143.95.166.233"
$VPS_PORT = 22022
$VPS_USER = "root"
$APP_DIR  = "/var/www/unyco-eventos"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  UNYCO Esporte - Deploy Remoto na VPS         " -ForegroundColor Cyan
Write-Host "  Servidor: $VPS_HOST (Porta: $VPS_PORT)       " -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Garantir que tudo local está no Git
Write-Host "[1/3] Verificando repositório Git..." -ForegroundColor Yellow
git push origin main
Write-Host "   -> Git sincronizado com sucesso no GitHub." -ForegroundColor Green
Write-Host ""

# 2. Comandos que serão executados remotamente na VPS
$RemoteCommands = @"
set -e
echo '=== [VPS] Atualizando UNYCO Esporte ==='
mkdir -p $APP_DIR
cd $APP_DIR

if [ -d "$APP_DIR/.git" ]; then
    echo '-> Puxando alteracoes do Git...'
    git fetch origin main
    git reset --hard origin/main
else
    echo '-> Clonando repositorio...'
    git clone https://github.com/hikoguedes/Unyco_eventos.git .
fi

echo '-> Criando diretorios de upload...'
mkdir -p public/uploads/partners public/uploads/events public/uploads/avatars

echo '-> Instalando dependencias...'
npm install --omit=dev --legacy-peer-deps 2>&1 | tail -5

echo '-> Aplicando migracoes no banco PostgreSQL...'
sudo -u postgres psql unyco_eventos_db -c "ALTER TABLE inscricoes_evento ADD COLUMN IF NOT EXISTS parceiro_indicador_id INTEGER REFERENCES parceiros(id);" 2>/dev/null || true
sudo -u postgres psql unyco_eventos_db -c "ALTER TABLE inscricoes_evento ADD COLUMN IF NOT EXISTS origem_inscricao VARCHAR(50) DEFAULT 'ORGANICO';" 2>/dev/null || true

echo '-> Reiniciando aplicacao no PM2...'
pm2 restart unyco-eventos || pm2 start src/server.js --name unyco-eventos --env production
pm2 save

echo '=== [VPS] Deploy finalizado com sucesso! ==='
"@

# 3. Execução via SSH
Write-Host "[2/3] Conectando à VPS via SSH na porta $VPS_PORT..." -ForegroundColor Yellow
Write-Host "(Se solicitado, digite a senha de root do servidor)" -ForegroundColor Gray
Write-Host ""

ssh -p $VPS_PORT -o StrictHostKeyChecking=accept-new ${VPS_USER}@${VPS_HOST} $RemoteCommands

Write-Host ""
Write-Host "[3/3] Verificando saúde da aplicação em produção..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
try {
    $res = Invoke-RestMethod -Uri "https://unycopass.com.br/unycoeventos/health" -SkipCertificateCheck -TimeoutSec 10
    Write-Host "   -> Status: $($res.status)" -ForegroundColor Green
    Write-Host "   -> Banco: $($res.database) ($($res.database_mode))" -ForegroundColor Green
    Write-Host "   -> Uptime: $($res.uptime)s" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 DEPLOY CONCLUÍDO COM SUCESSO!" -ForegroundColor Green
    Write-Host "Acesse: https://unycopass.com.br/unycoeventos/" -ForegroundColor Cyan
} catch {
    Write-Host "   Aviso: Verifique o status manualmente em https://unycopass.com.br/unycoeventos/" -ForegroundColor Yellow
}
