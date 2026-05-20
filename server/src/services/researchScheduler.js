const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const { queryObjects, queryOne, runSql } = require('../database');
const ContentAI = require('./ai');
const { startPipeline } = require('./stageManager');

const contentAI = new ContentAI();
let researchTask = null;

function startResearchScheduler() {
  const config = require('../config');
  const schedule = config.research.schedule;
  const autoApprove = config.research.autoApprove;

  researchTask = cron.schedule(schedule, async () => {
    console.log('[Research] Executando pesquisa agendada...');
    await runAutomatedResearch(autoApprove);
  });

  console.log(`[Research] Pesquisa automatica agendada: "${schedule}"`);
}

function stopResearchScheduler() {
  if (researchTask) {
    researchTask.stop();
    researchTask = null;
  }
}

async function runAutomatedResearch(autoApprove = false) {
  try {
    const keywords = queryObjects('SELECT id, keyword FROM research_keywords WHERE active = 1 ORDER BY created_at ASC');
    if (keywords.length === 0) {
      console.log('[Research] Nenhuma keyword ativa para pesquisa.');
      return 0;
    }

    const briefingRow = queryObjects('SELECT id, content FROM briefings WHERE active = 1 ORDER BY created_at DESC LIMIT 1');
    if (briefingRow.length === 0) {
      console.log('[Research] Nenhum briefing ativo. Pesquisa cancelada.');
      return;
    }

    const briefing = briefingRow[0];
    const now = Math.floor(Date.now() / 1000);
    let suggestionsCreated = 0;

    for (const kw of keywords) {
      try {
        console.log(`[Research] Pesquisando keyword: "${kw.keyword}"`);
        const suggestion = await contentAI.generateResearchSuggestion(briefing.content, kw.keyword);

        const id = uuidv4();
        runSql(
          'INSERT INTO suggestions (id, briefing_id, keyword_used, platform, format, title, description, hashtags, content_generated, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [id, briefing.id, kw.keyword, suggestion.platform, suggestion.format, suggestion.title, suggestion.description,
           JSON.stringify(suggestion.hashtags || []), JSON.stringify(suggestion),
           autoApprove ? 'approved' : 'pending',
           now, now]
        );

        runSql('UPDATE research_keywords SET last_run = ? WHERE id = ?', [now, kw.id]);
        suggestionsCreated++;

        if (autoApprove) {
          const postId = await autoCreatePostFromSuggestion(id, kw.keyword);
          if (postId) {
            startPipeline(postId, null).then(result => {
              if (result.needsApproval) {
                console.log(`[Research] Post ${postId} aguardando aprovacao.`);
              }
            });
          }
        }

        console.log(`[Research] Sugestao criada para "${kw.keyword}": ${suggestion.title}`);
      } catch (err) {
        console.error(`[Research] Erro ao pesquisar "${kw.keyword}":`, err.message);
      }
    }

    console.log(`[Research] Concluido. ${suggestionsCreated} sugestao(oes) criada(s).`);
    return suggestionsCreated;
  } catch (err) {
    console.error('[Research] Erro na pesquisa automatizada:', err.message);
    return 0;
  }
}

async function autoCreatePostFromSuggestion(suggestionId, keyword) {
  try {
    const sug = queryOne('SELECT * FROM suggestions WHERE id = ?', [suggestionId]);
    if (!sug) return false;

    const postId = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const nextStage = 'criar';
    const member = queryOne('SELECT name FROM team_members WHERE stage = ?', [nextStage]);

    let hashtags = [];
    try { hashtags = JSON.parse(sug.hashtags || '[]'); } catch {}

    let contentData = {};
    try { contentData = JSON.parse(sug.content_generated || '{}'); } catch {}

    runSql(
      'INSERT INTO posts (id, title, description, platform, stage, assigned_to, content, hashtags, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [postId, sug.title, sug.description || '', sug.platform, nextStage, member?.name || 'Carla Cria',
       contentData.content || '', JSON.stringify(hashtags), now, now, null]
    );

    runSql('UPDATE suggestions SET post_id = ?, status = ?, updated_at = ? WHERE id = ?',
      [postId, 'approved', now, sug.id]);

    console.log(`[Research] Post criado automaticamente: "${sug.title}" (${postId})`);
    return postId;
  } catch (err) {
    console.error('[Research] Erro ao criar post da sugestao:', err.message);
    return false;
  }
}

async function approveSuggestion(suggestionId) {
  try {
    const sug = queryOne('SELECT * FROM suggestions WHERE id = ?', [suggestionId]);
    if (!sug || sug.status !== 'pending') return null;

    const postId = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const nextStage = 'criar';
    const member = queryOne('SELECT name FROM team_members WHERE stage = ?', [nextStage]);

    let hashtags = [];
    try { hashtags = JSON.parse(sug.hashtags || '[]'); } catch {}

    let contentData = {};
    try { contentData = JSON.parse(sug.content_generated || '{}'); } catch {}

    runSql(
      'INSERT INTO posts (id, title, description, platform, stage, assigned_to, content, hashtags, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [postId, sug.title, sug.description || '', sug.platform, nextStage, member?.name || 'Carla Cria',
       contentData.content || '', JSON.stringify(hashtags), now, now, null]
    );

    runSql('UPDATE suggestions SET post_id = ?, status = ?, updated_at = ? WHERE id = ?',
      [postId, 'approved', now, sug.id]);

    const post = queryOne('SELECT * FROM posts WHERE id = ?', [postId]);
    if (post) {
      startPipeline(postId, null).catch(err => console.error('[Research] Erro na pipeline:', err.message));
    }
    return post ? { ...post, hashtags, feedback: [], metrics: null } : null;
  } catch (err) {
    console.error('[Research] Erro ao aprovar sugestao:', err.message);
    return null;
  }
}

async function rejectSuggestion(suggestionId) {
  const now = Math.floor(Date.now() / 1000);
  runSql("UPDATE suggestions SET status = 'rejected', updated_at = ? WHERE id = ? AND status = 'pending'", [now, suggestionId]);
  return true;
}

module.exports = { startResearchScheduler, stopResearchScheduler, runAutomatedResearch, approveSuggestion, rejectSuggestion };