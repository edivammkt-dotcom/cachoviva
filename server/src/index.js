const express = require('express');
const path = require('path');
const cors = require('cors');
const cron = require('node-cron');
const { initDatabase } = require('./database');
const { startAll } = require('./services/scheduler');
const { startResearchScheduler } = require('./services/researchScheduler');
const { startPolling, sendToTelegram } = require('./services/telegram');
const { initialize: initOrchestrator } = require('./services/orchestrator');
const { startWeeklyCycle, generateMetricsDigest } = require('./services/weeklyOrchestrator');
const config = require('./config');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/team', require('./routes/team'));
app.use('/api/social', require('./routes/social'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/research', require('./routes/research'));
app.use('/api/leads', require('./routes/leads'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

app.get('/api/stages', (req, res) => {
  res.json([
    { id: 'pesquisar', label: 'Pesquisar', icon: '🔍' },
    { id: 'planejar', label: 'Planejar', icon: '📅' },
    { id: 'criar', label: 'Criar', icon: '✍️' },
    { id: 'editar', label: 'Editar', icon: '📝' },
    { id: 'validar', label: 'Validar', icon: '✅' },
    { id: 'aprovar', label: 'Aprovar', icon: '👍' },
    { id: 'publicar', label: 'Publicar', icon: '🚀' },
    { id: 'medir', label: 'Medir', icon: '📈' }
  ]);
});

app.get('/api/platforms', (req, res) => {
  res.json(['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'facebook']);
});

app.get('/api/launch', (req, res) => {
  // Data fixa de lançamento: 30 dias após 20/05/2026
  const launch = new Date('2026-06-19T00:00:00-03:00');
  res.json({ launch: launch.toISOString(), now: new Date().toISOString() });
});

async function startServer() {
  await initDatabase();
  await initOrchestrator();
  startAll();
  startResearchScheduler();
  startPolling();

  // CRON: Ciclo semanal toda segunda-feira às 7h
  cron.schedule('0 7 * * 1', async () => {
    console.log('[Cron] Iniciando ciclo semanal...');
    try {
      const result = await startWeeklyCycle();
      console.log(`[Cron] Ciclo semanal: ${result?.postsCount || 0} posts gerados`);
    } catch (err) {
      console.error('[Cron] Erro no ciclo semanal:', err.message);
    }
  });
  console.log('[Cron] Ciclo semanal: Seg 07:00');

  // CRON: Digest de métricas todo dia às 8h
  cron.schedule('0 8 * * *', async () => {
    console.log('[Cron] Gerando digest de métricas...');
    try {
      const digest = await generateMetricsDigest();
      if (digest?.mensagem_telegram) {
        await sendToTelegram(digest.mensagem_telegram);
      }
    } catch (err) {
      console.error('[Cron] Erro no digest:', err.message);
    }
  });
  console.log('[Cron] Digest métricas: Diário 08:00');

  app.listen(config.port, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║        Squad CachoViva - Backend             ║
║──────────────────────────────────────────────║
║  Servidor: http://localhost:${config.port}        ║
║  API:     http://localhost:${config.port}/api    ║
║  Pesquisa Automatica: ${config.research.schedule.padEnd(14)}║
║  Ambiente: ${config.env.padEnd(30)}║
╚══════════════════════════════════════════════╝
    `);
  });
}

startServer();
