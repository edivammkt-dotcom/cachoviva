const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const config = require('./config');

let db = null;
let SQL = null;

function getDbPath() {
  const dbPath = path.resolve(config.db.path);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dbPath;
}

async function initDatabase() {
  SQL = await initSqlJs();
  const dbPath = getDbPath();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  createTables();
  seedData();
  saveDatabase();
  return db;
}

function saveDatabase() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const dbPath = getDbPath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('Erro ao salvar database:', err);
  }
}

function createTables() {
  db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'admin', created_at INTEGER DEFAULT (strftime('%s','now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS team_members (role TEXT PRIMARY KEY, name TEXT NOT NULL, stage TEXT NOT NULL, active INTEGER DEFAULT 1)`);
  db.run(`CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', platform TEXT DEFAULT 'instagram', stage TEXT DEFAULT 'pesquisar', assigned_to TEXT DEFAULT '', content TEXT DEFAULT '', hashtags TEXT DEFAULT '[]', scheduled_date TEXT DEFAULT '', published_date TEXT DEFAULT '', metrics TEXT DEFAULT 'null', feedback TEXT DEFAULT '[]', created_at INTEGER DEFAULT (strftime('%s','now')), updated_at INTEGER DEFAULT (strftime('%s','now')), user_id TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS social_accounts (id TEXT PRIMARY KEY, platform TEXT NOT NULL, account_name TEXT NOT NULL, account_id TEXT NOT NULL, access_token TEXT, refresh_token TEXT, token_expires_at INTEGER, connected_at INTEGER DEFAULT (strftime('%s','now')), user_id TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS automation_log (id TEXT PRIMARY KEY, action TEXT NOT NULL, post_id TEXT, details TEXT DEFAULT '', status TEXT DEFAULT 'success', created_at INTEGER DEFAULT (strftime('%s','now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS scheduled_publishes (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, platform TEXT NOT NULL, scheduled_date TEXT NOT NULL, status TEXT DEFAULT 'pending', published_at INTEGER, error TEXT, created_at INTEGER DEFAULT (strftime('%s','now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS generated_content (id TEXT PRIMARY KEY, user_id TEXT, type TEXT NOT NULL, platform TEXT NOT NULL, data TEXT DEFAULT '{}', created_at INTEGER DEFAULT (strftime('%s','now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS briefings (id TEXT PRIMARY KEY, content TEXT NOT NULL, platform_focus TEXT DEFAULT 'instagram', active INTEGER DEFAULT 1, source TEXT DEFAULT 'manual', created_at INTEGER DEFAULT (strftime('%s','now')), updated_at INTEGER DEFAULT (strftime('%s','now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS research_keywords (id TEXT PRIMARY KEY, keyword TEXT NOT NULL, active INTEGER DEFAULT 1, schedule_cron TEXT DEFAULT '0 8 * * 1-5', last_run INTEGER, created_at INTEGER DEFAULT (strftime('%s','now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS suggestions (id TEXT PRIMARY KEY, briefing_id TEXT, keyword_used TEXT, platform TEXT NOT NULL, format TEXT NOT NULL, title TEXT NOT NULL, description TEXT, hashtags TEXT DEFAULT '[]', content_generated TEXT, status TEXT DEFAULT 'pending', post_id TEXT, created_at INTEGER DEFAULT (strftime('%s','now')), updated_at INTEGER DEFAULT (strftime('%s','now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS telegram_config (id TEXT PRIMARY KEY, bot_token TEXT NOT NULL, chat_id TEXT, enabled INTEGER DEFAULT 0, last_offset INTEGER DEFAULT 0, created_at INTEGER DEFAULT (strftime('%s','now')), updated_at INTEGER DEFAULT (strftime('%s','now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS telegram_messages (id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, text TEXT NOT NULL, processed INTEGER DEFAULT 0, message_type TEXT DEFAULT 'text', created_at INTEGER DEFAULT (strftime('%s','now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS weekly_cycles (id TEXT PRIMARY KEY, status TEXT DEFAULT 'planning', telegram_chat_id TEXT DEFAULT '', squad1_output TEXT DEFAULT '{}', squad2_output TEXT DEFAULT '{}', posts_data TEXT DEFAULT '[]', approved_at INTEGER, created_at INTEGER DEFAULT (strftime('%s','now')), updated_at INTEGER DEFAULT (strftime('%s','now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS cycle_posts (id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL, ordem INTEGER DEFAULT 0, plataforma TEXT DEFAULT '', tipo TEXT DEFAULT '', objetivo TEXT DEFAULT '', titulo TEXT DEFAULT '', squad3_output TEXT DEFAULT '{}', squad4_output TEXT DEFAULT '{}', score INTEGER DEFAULT 0, status TEXT DEFAULT 'processing', created_at INTEGER DEFAULT (strftime('%s','now')), updated_at INTEGER DEFAULT (strftime('%s','now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT DEFAULT '',
    diagnosis TEXT NOT NULL,
    diagnosis_name TEXT DEFAULT '',
    scores TEXT DEFAULT '{}',
    answers TEXT DEFAULT '[]',
    kit_interest INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);
}

function queryObjects(sql, params = []) {
  try {
    if (params.length > 0) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    }
    const result = db.exec(sql);
    if (result.length === 0) return [];
    const { columns, values } = result[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  } catch (err) {
    console.error('Query error:', sql, params, err.message);
    return [];
  }
}

function queryOne(sql, params = []) {
  const results = queryObjects(sql, params);
  return results.length > 0 ? results[0] : null;
}

function runSql(sql, params = []) {
  try {
    db.run(sql, params);
    saveDatabase();
    return true;
  } catch (err) {
    console.error('Run error:', sql, params, err.message);
    return false;
  }
}

function prepareStmt(sql) {
  return db.prepare(sql);
}

function seedData() {
  const rows = queryObjects('SELECT COUNT(*) as cnt FROM team_members');
  if (rows.length === 0 || rows[0].cnt === 0) {
    const members = [
      ['Pesquisador', 'Ana Pesquisa', 'pesquisar'],
      ['Planejador', 'Bruno Planeja', 'planejar'],
      ['Criador', 'Carla Cria', 'criar'],
      ['Editor', 'Diego Edita', 'editar'],
      ['Validador', 'Eva Valida', 'validar'],
      ['Aprovador', 'Fábio Aprova', 'aprovar'],
      ['Publicador', 'Gabi Publica', 'publicar'],
      ['Analista', 'Hugo Mede', 'medir']
    ];
    for (const m of members) {
      db.run('INSERT OR IGNORE INTO team_members (role, name, stage) VALUES (?, ?, ?)', m);
    }
  }

  const postRows = queryObjects('SELECT COUNT(*) as cnt FROM posts');
  if (postRows.length === 0 || postRows[0].cnt === 0) {
    const now = Math.floor(Date.now() / 1000);
    const posts = [
      ['post-1', 'Como finalizar cabelos cacheados', 'Passo a passo completo de finalização para cabelos cacheados', 'instagram', 'pesquisar', 'Ana Pesquisa', '', '["#cachosdefinidos","#finalizacao","#cabelocacheado"]', '', '', 'null', '[]', now - 432000, now - 432000, null],
      ['post-2', 'Review: Linha Umectação CachoViva', 'Review completo da nova linha de umectação', 'youtube', 'criar', 'Carla Cria', 'Roteiro: 1. Introdução 2. Produtos 3. Demonstração', '["#umectacao","#cachoviva","#review"]', '', '', 'null', '[]', now - 259200, now - 172800, null],
      ['post-3', 'Dica: Difusor perfeito', 'Tutorial de como usar o difusor para volume e definição', 'tiktok', 'aprovar', 'Fábio Aprova', 'Vídeo de 60s mostrando técnica de difusão', '["#dicadodia","#difusor","#cachos"]', '', '', 'null', '[{"text":"Aumentar tempo de demonstração","by":"Sistema","date":"13/05/2026"}]', now - 86400, now - 86400, null],
      ['post-4', 'Cronograma capilar mensal', 'Guia completo de cronograma capilar para todos os tipos de cacho', 'instagram', 'medir', 'Hugo Mede', 'Post carrossel com 8 slides', '["#cronogramacapilar","#cuidadoscomocabelo"]', '2026-05-10', '2026-05-10', '{"likes":234,"comments":45,"shares":89,"reach":3500,"saves":120}', '[]', now - 1036800, now - 172800, null],
      ['post-5', '5 erros na transição capilar', 'Erros comuns que atrapalham a transição capilar e como evitá-los', 'youtube', 'editar', 'Diego Edita', 'Roteiro completo para vídeo de 8 minutos', '["#transicaocapilar","#cachos","#dicas"]', '', '', 'null', '[{"text":"Adicionar exemplos visuais","by":"Sistema","date":"12/05/2026"}]', now - 345600, now - 86400, null]
    ];
    const stmt = db.prepare('INSERT INTO posts (id, title, description, platform, stage, assigned_to, content, hashtags, scheduled_date, published_date, metrics, feedback, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const p of posts) {
      stmt.run(p);
    }
  }
  saveDatabase();
}

function getDb() { return db; }
module.exports = { initDatabase, getDb, saveDatabase, queryObjects, queryOne, runSql, prepareStmt };
