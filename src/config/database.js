const { Pool, Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let activePool = null;
let initPromise = null;
let embeddedInstance = null;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5442', 10),
  user: process.env.DB_USER || 'unyco_user',
  password: process.env.DB_PASSWORD || 'unyco_secret',
  database: process.env.DB_NAME || 'unyco_eventos_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
};

// Inicialização automática e criação de tabelas a partir do init.sql caso necessário
async function seedDatabaseIfEmpty(pool) {
  try {
    const res = await pool.query(`
      SELECT to_regclass('public.usuarios') AS table_exists;
    `);
    
    if (!res.rows[0] || !res.rows[0].table_exists) {
      console.log('⚡ [UNYCO DB] Executando carga inicial de dados (init.sql)...');
      const initSqlPath = path.join(__dirname, '..', '..', 'init.sql');
      if (fs.existsSync(initSqlPath)) {
        const sql = fs.readFileSync(initSqlPath, 'utf-8');
        await pool.query(sql);
        console.log('✅ [UNYCO DB] Estrutura e dados de seed inicializados com sucesso!');
      }
    }
  } catch (err) {
    console.error('⚠️ [UNYCO DB] Erro ao verificar ou semear banco:', err.message);
  }
}

// Iniciar PostgreSQL embarcado caso PostgreSQL externo/docker não responda
async function startEmbeddedPostgres() {
  try {
    console.log('⚡ [UNYCO DB] Iniciando PostgreSQL embarcado local...');
    const EmbeddedPostgres = require('embedded-postgres').default;
    embeddedInstance = new EmbeddedPostgres({
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: 'postgres',
    });

    try {
      await embeddedInstance.start();
    } catch (_) {
      try {
        await embeddedInstance.initialise();
        await embeddedInstance.start();
      } catch (initErr) {
        console.warn('Postgres cluster warning:', initErr.message);
      }
    }

    // Garantir banco unyco_eventos_db
    const rootClient = new Client({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: 'postgres',
    });

    try {
      await rootClient.connect();
      await rootClient.query(`CREATE DATABASE ${dbConfig.database}`).catch(() => {});
      await rootClient.end();
    } catch (_) {}

    console.log(`✅ [UNYCO DB] PostgreSQL embarcado ativo na porta ${dbConfig.port}!`);
  } catch (err) {
    console.error('❌ [UNYCO DB] Erro ao iniciar PostgreSQL embarcado:', err.message);
    throw err;
  }
}

// Inicializador resiliente com autoconexão
async function initDatabase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // 1. Tentar conectar ao PostgreSQL já em execução (Docker ou Local)
    let pool = new Pool(dbConfig);
    pool.on('error', (err) => {
      console.warn('⚠️ [UNYCO DB] Erro no pool de conexão PostgreSQL (ignorado para resiliência):', err.message);
    });
    try {
      const client = await pool.connect();
      client.release();
      console.log(`📦 [UNYCO DB] Conectado ao PostgreSQL em ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
      activePool = pool;
      await seedDatabaseIfEmpty(activePool);
      return activePool;
    } catch (err) {
      console.warn(`⚠️ [UNYCO DB] PostgreSQL não detectado em ${dbConfig.host}:${dbConfig.port}. Iniciando motor embarcado...`);
      await pool.end().catch(() => {});
      
      // 2. Iniciar PostgreSQL embarcado nativo
      await startEmbeddedPostgres();

      // 3. Reconectar
      pool = new Pool(dbConfig);
      pool.on('error', (err) => {
        console.warn('⚠️ [UNYCO DB] Erro no pool de conexão PostgreSQL (ignorado para resiliência):', err.message);
      });
      const client = await pool.connect();
      client.release();
      console.log(`📦 [UNYCO DB] Conectado com sucesso ao banco PostgreSQL!`);
      activePool = pool;
      await seedDatabaseIfEmpty(activePool);
      return activePool;
    }
  })();

  return initPromise;
}

// Inicializar imediatamente em background
initDatabase();

// Wrapper de query seguro e assíncrono
const query = async (text, params) => {
  if (!activePool) {
    await initDatabase();
  }
  return activePool.query(text, params);
};

// Proxy para o pool exportado
const poolProxy = new Proxy({}, {
  get(target, prop) {
    if (prop === 'query') return query;
    if (prop === 'isReady') return !!activePool;
    if (activePool && typeof activePool[prop] === 'function') {
      return activePool[prop].bind(activePool);
    }
    return activePool ? activePool[prop] : undefined;
  }
});

module.exports = {
  query,
  pool: poolProxy,
  initDatabase,
  stopEmbedded: async () => {
    if (embeddedInstance) {
      await embeddedInstance.stop().catch(() => {});
    }
  }
};
