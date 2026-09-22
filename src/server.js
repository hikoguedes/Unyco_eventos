const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const db = require('./config/database');
const partnerRoutes = require('./routes/partnerRoutes');
const eventRoutes = require('./routes/eventRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const proposalRoutes = require('./routes/proposalRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const statsRoutes = require('./routes/statsRoutes');
const hotelRoutes = require('./routes/hotelRoutes');
const earningsRoutes = require('./routes/earningsRoutes');
const authRoutes = require('./routes/authRoutes');
const { authenticate } = require('./middlewares/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3060;

const fs = require('fs');
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/$/, '');

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(authenticate);

// Forçar no-cache em todos os arquivos estáticos
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Helper para enviar HTML com BASE_PATH injetado se necessário
function sendProcessedHtml(filePath, res) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    if (BASE_PATH) {
      // Injeta window.BASE_PATH no head
      content = content.replace('<head>', `<head>\n  <script>window.BASE_PATH = "${BASE_PATH}";</script>`);
      // Ajusta caminhos absolutos /css/, /js/, /img/, /api/
      content = content.replace(/(href|src)=["']\/([^"']+)["']/g, `$1="${BASE_PATH}/$2"`);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(content);
  } catch (err) {
    return res.sendFile(filePath);
  }
}

// Servir arquivos estáticos da interface web
if (BASE_PATH) {
  app.use(BASE_PATH, express.static(path.join(__dirname, '..', 'public'), { index: false, etag: false, maxAge: 0, lastModified: false }));
}
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false, etag: false, maxAge: 0, lastModified: false }));

// Rotas da API REST (Montadas na raiz e no subcaminho se houver)
const mountRoutes = (prefix = '') => {
  app.use(`${prefix}/api/auth`, authRoutes);
  app.use(`${prefix}/api/partners`, partnerRoutes);
  app.use(`${prefix}/api/events`, eventRoutes);
  app.use(`${prefix}/api/categories`, categoryRoutes);
  app.use(`${prefix}/api/proposals`, proposalRoutes);
  app.use(`${prefix}/api/hotels`, hotelRoutes);
  app.use(`${prefix}/api/earnings`, earningsRoutes);
  app.use(`${prefix}/api`, registrationRoutes);
  app.use(`${prefix}/api/stats`, statsRoutes);
};

mountRoutes('');
if (BASE_PATH) {
  mountRoutes(BASE_PATH);
}

// Healthcheck do sistema e do banco
const healthHandler = async (req, res) => {
  try {
    const dbCheck = await db.query('SELECT NOW() AS db_now');
    return res.json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      database: 'CONNECTED',
      database_mode: db.isInMemory ? 'in-memory' : 'postgresql',
      database_engine: db.isInMemory ? 'PostgreSQL (In-Memory)' : 'PostgreSQL (Native/Docker)',
      db_time: dbCheck.rows && dbCheck.rows[0] ? dbCheck.rows[0].db_now : new Date(),
      uptime: process.uptime(),
      base_path: BASE_PATH || '/',
    });
  } catch (error) {
    return res.status(503).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      database: 'DISCONNECTED',
      error: error.message,
    });
  }
};

app.get('/health', healthHandler);
if (BASE_PATH) {
  app.get(`${BASE_PATH}/health`, healthHandler);
}

// Rota pública da Landing Page
app.get('/lp.html', (req, res) => {
  sendProcessedHtml(path.join(__dirname, '..', 'public', 'lp.html'), res);
});

// Rota raiz e rota do subcaminho
if (BASE_PATH) {
  app.get(BASE_PATH, (req, res) => {
    sendProcessedHtml(path.join(__dirname, '..', 'public', 'index.html'), res);
  });
  app.get(`${BASE_PATH}/`, (req, res) => {
    sendProcessedHtml(path.join(__dirname, '..', 'public', 'index.html'), res);
  });
  app.get(`${BASE_PATH}/lp.html`, (req, res) => {
    sendProcessedHtml(path.join(__dirname, '..', 'public', 'lp.html'), res);
  });
}

// Fallback para SPA (Single Page Application)
app.get('*', (req, res) => {
  sendProcessedHtml(path.join(__dirname, '..', 'public', 'index.html'), res);
});

// Inicialização do servidor HTTP
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 UNYCO Esporte - Gestão de Eventos e Parceiros`);
  console.log(`🌐 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
  console.log(`📡 API Parceiros: http://localhost:${PORT}/api/partners`);
  console.log(`⚽ API Eventos: http://localhost:${PORT}/api/events`);
  console.log(`📈 API Estatísticas: http://localhost:${PORT}/api/stats`);
  console.log(`====================================================`);
});

// Tratamento de encerramento gracioso
const gracefulShutdown = () => {
  console.log('\n🛑 Encerrando servidor graciosamente...');
  server.close(async () => {
    console.log('🔒 Servidor HTTP fechado.');
    try {
      if (db.pool && typeof db.pool.end === 'function') {
        await db.pool.end().catch(() => {});
      }
      if (typeof db.stopEmbedded === 'function') {
        await db.stopEmbedded().catch(() => {});
      }
      console.log('📦 Conexões com o PostgreSQL encerradas.');
      process.exit(0);
    } catch (err) {
      console.error('Erro ao fechar pool de banco:', err);
      process.exit(1);
    }
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
