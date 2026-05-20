const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const { queryObjects, queryOne, runSql } = require('../database');

const STAGES = ['pesquisar', 'planejar', 'criar', 'editar', 'validar', 'aprovar', 'publicar', 'medir'];
let publishTask, metricsTask, advanceTask, cleanTask;

function startAll() {
  const config = require('../config');
  startPublishChecker(config.intervals.publishCheck);
  startMetricsCollector(config.intervals.metricsCollect);
  startAutoAdvance();
  startLogCleanup();
  console.log('[Scheduler] Automações iniciadas');
}

function stopAll() {
  [publishTask, metricsTask, advanceTask, cleanTask].forEach(t => { if (t) { t.stop(); } });
  publishTask = metricsTask = advanceTask = cleanTask = null;
  console.log('[Scheduler] Automações paradas');
}

function startPublishChecker(interval) {
  publishTask = cron.schedule(interval, async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = Math.floor(Date.now() / 1000);
      const posts = queryObjects("SELECT * FROM posts WHERE stage = 'publicar' AND scheduled_date = ? AND scheduled_date != ''", [today]);
      
      for (const post of posts) {
        const accounts = queryObjects("SELECT * FROM social_accounts WHERE platform = ? AND user_id IS NOT NULL", [post.platform]);
        if (!accounts || accounts.length === 0) {
          console.log(`[Auto-Publish] Nenhuma conta ${post.platform} conectada para "${post.title}"`);
          continue;
        }
        
        const account = accounts[0];
        let result;
        
        // Publicar na plataforma correta
        switch (post.platform) {
          case 'instagram':
            const { publishPost: publishInstagram } = require('./instagram');
            result = await publishInstagram(post, account);
            break;
          case 'tiktok':
            const { publishPost: publishTikTok } = require('./tiktok');
            result = await publishTikTok(post, account);
            break;
          case 'youtube':
            const { publishPost: publishYouTube } = require('./youtube');
            result = await publishYouTube(post, account);
            break;
          default:
            console.log(`[Auto-Publish] Plataforma ${post.platform} não suportada`);
            continue;
        }
        
        if (result.success) {
          const analyst = queryOne("SELECT name FROM team_members WHERE stage = 'medir'");
          runSql('UPDATE posts SET stage=?, assigned_to=?, published_date=?, updated_at=? WHERE id=?', ['medir', analyst?.name||'', today, now, post.id]);
          logAuto('auto_publish', post.id, `Publicado com sucesso em ${today} via ${post.platform}`);
          console.log(`[Auto-Publish] "${post.title}" publicado no ${post.platform}`);
        } else {
          logAuto('publish_failed', post.id, `Falha: ${result.error}`);
          console.log(`[Auto-Publish] Falha ao publicar "${post.title}": ${result.error}`);
        }
      }
    } catch (err) { console.error('[Scheduler] Publish error:', err); }
  });
  console.log(`[Scheduler] Publicação automática: "${interval}"`);
}

function startMetricsCollector(interval) {
  metricsTask = cron.schedule(interval, async () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const posts = queryObjects("SELECT * FROM posts WHERE stage='medir' AND published_date!=''");
      
      for (const post of posts) {
        const accounts = queryObjects("SELECT * FROM social_accounts WHERE platform = ? AND user_id IS NOT NULL", [post.platform]);
        if (!accounts || accounts.length === 0) continue;
        
        const account = accounts[0];
        let metrics;
        
        // Coletar métricas da plataforma correta
        switch (post.platform) {
          case 'instagram':
            const { getMetrics: getIGMetrics } = require('./instagram');
            metrics = await getIGMetrics(post, account);
            break;
          case 'tiktok':
            const { getMetrics: getTKMetrics } = require('./tiktok');
            metrics = await getTKMetrics(post, account);
            break;
          case 'youtube':
            const { getMetrics: getYTMetrics } = require('./youtube');
            metrics = await getYTMetrics(post, account);
            break;
          default:
            continue;
        }
        
        if (metrics) {
          const currentMetrics = JSON.parse(post.metrics || '{}');
          const updatedMetrics = { ...currentMetrics, ...metrics };
          runSql('UPDATE posts SET metrics=?, updated_at=? WHERE id=?', [JSON.stringify(updatedMetrics), now, post.id]);
          logAuto('metrics_collect', post.id, `Métricas atualizadas: ${JSON.stringify(metrics)}`);
          console.log(`[Auto-Metrics] Métricas atualizadas para "${post.title}": ${JSON.stringify(metrics)}`);
        }
      }
    } catch (err) { console.error('[Scheduler] Metrics error:', err); }
  });
  console.log(`[Scheduler] Coleta de métricas: "${interval}"`);
}

function startAutoAdvance() {
  advanceTask = cron.schedule('0 9 * * 1-5', () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const pending = queryObjects("SELECT * FROM posts WHERE stage NOT IN ('medir','publicar') ORDER BY updated_at ASC");
      for (const post of pending) {
        const idx = STAGES.indexOf(post.stage);
        if (idx >= 0 && idx < STAGES.length - 2) {
          const daysSinceUpdate = (now - post.updated_at) / 86400;
          if (daysSinceUpdate >= 3) {
            const nextStage = STAGES[idx + 1];
            const member = queryOne('SELECT name FROM team_members WHERE stage = ?', [nextStage]);
            runSql('UPDATE posts SET stage=?, assigned_to=?, updated_at=? WHERE id=?', [nextStage, member?.name||'', now, post.id]);
            logAuto('auto_advance', post.id, `Avanço automático para ${nextStage}`);
            console.log(`[Auto-Advance] "${post.title}" → ${nextStage}`);
          }
        }
      }
    } catch (err) { console.error('[Scheduler] Advance error:', err); }
  });
  console.log('[Scheduler] Avanço automático ativo');
}

function startLogCleanup() {
  cleanTask = cron.schedule('0 0 1 * *', () => {
    try {
      const cutoff = Math.floor(Date.now()/1000) - 86400*90;
      runSql('DELETE FROM automation_log WHERE created_at < ?', [cutoff]);
      console.log('[Cleanup] Logs antigos removidos');
    } catch (err) { console.error('[Scheduler] Cleanup error:', err); }
  });
  console.log('[Scheduler] Limpeza de logs ativa');
}

function logAuto(action, postId, details) {
  runSql('INSERT INTO automation_log (id, action, post_id, details, created_at) VALUES (?, ?, ?, ?, ?)',
    [uuidv4(), action, postId, details, Math.floor(Date.now()/1000)]);
}

module.exports = { startAll, stopAll };
