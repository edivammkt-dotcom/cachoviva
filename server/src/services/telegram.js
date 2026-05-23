const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryObjects, runSql } = require('../database');
const { processIncomingMessage, handleApprove, handleEdit, handleReject } = require('./orchestrator');
const {
  startWeeklyCycle, approveCycle, adjustPost, rejectCycle,
  getActiveCycle, getStatusSummary, generateMetricsDigest,
  setPaused, isCyclePaused,
  processSingleInput, approveSingleInput, rejectSingleInput,
  setNotifyCallback: setOrchNotify
} = require('./weeklyOrchestrator');
const { executeSquad } = require('./squadManager');
const { setNotifyCallback } = require('./stageManager');
const { startPipeline } = require('./stageManager');

let pollTimer = null;
const TEMP_DIR = path.join(__dirname, '..', '..', 'temp', 'telegram_media');

function getConfig() {
  return queryOne('SELECT * FROM telegram_config WHERE enabled = 1');
}

function getConfigAny() {
  const all = queryObjects('SELECT * FROM telegram_config ORDER BY created_at DESC LIMIT 1');
  return all.length > 0 ? all[0] : null;
}

async function startPolling() {
  const cfg = getConfigAny();
  const appConfig = require('../config');

  setNotifyCallback(async (chatId, message) => {
    await sendTelegramMessage(chatId, message);
  });
  setOrchNotify(async (chatId, message) => {
    await sendTelegramMessage(chatId, message);
  });

  if (cfg?.bot_token) {
    console.log('[Telegram] Bot configurado. Iniciando polling...');
    doPoll(cfg);
  } else if (appConfig.telegram.botToken) {
    const token = appConfig.telegram.botToken;
    const chatId = appConfig.telegram.chatId;
    const id = uuidv4();
    runSql(
      'INSERT OR REPLACE INTO telegram_config (id, bot_token, chat_id, enabled, last_offset, created_at, updated_at) VALUES (?, ?, ?, 1, 0, ?, ?)',
      [id, token, chatId, Math.floor(Date.now()/1000), Math.floor(Date.now()/1000)]
    );
    console.log('[Telegram] Configurado via .env. Iniciando polling...');
    doPoll({ bot_token: token, chat_id: chatId, last_offset: 0 });
  } else {
    console.log('[Telegram] Nenhum token configurado. Telegram desativado.');
  }
}

async function doPoll(cfg) {
  if (!cfg?.bot_token) {
    pollTimer = setTimeout(() => {
      const next = getConfigAny();
      if (next) doPoll(next);
      else pollTimer = null;
    }, 10000);
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${cfg.bot_token}/getUpdates`;
    const offset = cfg.last_offset || 0;
    const resp = await axios.get(url, {
      params: { offset, timeout: 30, allowed_updates: ['message', 'callback_query'] },
      timeout: 30000
    });

    const updates = resp.data?.result || [];
    for (const update of updates) {
      // CALLBACK QUERY (botões clicáveis)
      if (update.callback_query) {
        const cq = update.callback_query;
        const chatId = String(cq.message.chat.id);
        const data = cq.data || '';
        const cqId = cq.id;

        const authorized = !cfg.chat_id || chatId === String(cfg.chat_id);
        if (!authorized) continue;

        // Responde ao callback para sumir o "loading" no botão
        await axios.post(`https://api.telegram.org/bot${cfg.bot_token}/answerCallbackQuery`, {
          callback_query_id: cqId,
          text: '⏳ Processando...'
        }).catch(() => {});

        // Processa o callback data como se fosse um comando
        const fakeMsgId = 'cq_' + String(update.update_id);
        runSql(
          'INSERT OR IGNORE INTO telegram_messages (id, chat_id, text, processed, message_type, created_at) VALUES (?, ?, ?, 1, ?, ?)',
          [fakeMsgId, chatId, data, 'callback_query', Math.floor(Date.now()/1000)]
        );

        console.log(`[Telegram] Callback: ${data}`);
        await processTelegramMessage(fakeMsgId, chatId, data);

        const lastUpdate = update.update_id + 1;
        runSql('UPDATE telegram_config SET last_offset = ?, updated_at = ? WHERE bot_token = ?',
          [lastUpdate, Math.floor(Date.now()/1000), cfg.bot_token]);
        cfg.last_offset = lastUpdate;
        continue;
      }

      // MENSAGEM DE TEXTO
      const msg = update.message;
      if (!msg) continue;

      const chatId = String(msg.chat.id);
      const text = (msg.text || '').trim();
      const msgId = String(update.update_id);

      if (!text) continue;

      const existing = queryOne('SELECT id FROM telegram_messages WHERE id = ?', [msgId]);
      if (existing) continue;

      const authorized = !cfg.chat_id || chatId === String(cfg.chat_id);
      if (!authorized) {
        console.log(`[Telegram] Mensagem ignorada de chat nao autorizado: ${chatId}`);
        continue;
      }

      runSql(
        'INSERT INTO telegram_messages (id, chat_id, text, processed, message_type, created_at) VALUES (?, ?, ?, 0, ?, ?)',
        [msgId, chatId, text, 'text', Math.floor(Date.now()/1000)]
      );
      console.log(`[Telegram] Mensagem recebida: ${text.substring(0, 60)}`);

      await processTelegramMessage(msgId, chatId, text);

      const lastUpdate = update.update_id + 1;
      runSql('UPDATE telegram_config SET last_offset = ?, updated_at = ? WHERE bot_token = ?',
        [lastUpdate, Math.floor(Date.now()/1000), cfg.bot_token]);
      cfg.last_offset = lastUpdate;
    }
  } catch (err) {
    if (err.code === 'ERR_BAD_REQUEST') {
      console.log('[Telegram] Token invalido ou bot desativado.');
    }
  }

  const interval = require('../config').telegram.pollInterval || 5000;
  pollTimer = setTimeout(() => {
    const next = getConfigAny();
    if (next) doPoll(next);
  }, interval);
}

async function processTelegramMessage(msgId, chatId, text) {
  const lower = text.toLowerCase().trim();

  // ─── /ok_semana — Aprovar ciclo semanal inteiro ───
  if (lower === '/ok_semana') {
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['approve_week', msgId]);
    const result = await approveCycle();
    await sendTelegramMessage(chatId, result.message);
    return;
  }

  // ─── /rejeitar — Rejeitar ciclo semanal ───
  if (lower === '/rejeitar') {
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['reject_week', msgId]);
    const result = await rejectCycle();
    await sendTelegramMessage(chatId, result.message);
    return;
  }

  // ─── /ajustar <id> <texto> — Ajustar post do ciclo ───
  const ajustarMatch = lower.match(/^\/ajustar\s+(\S+)\s+([\s\S]+)/);
  if (ajustarMatch) {
    const postId = ajustarMatch[1];
    const instructions = ajustarMatch[2].trim();
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['adjust', msgId]);
    const cycle = getActiveCycle();
    if (!cycle) {
      await sendTelegramMessage(chatId, '❌ Nenhum ciclo ativo.');
      return;
    }
    const result = await adjustPost(cycle.id, postId, instructions);
    await sendTelegramMessage(chatId, result.message || result);
    return;
  }

  // ─── /metricas — Digest completo ───
  if (lower === '/metricas') {
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['metrics', msgId]);
    await sendTelegramMessage(chatId, '📊 Gerando digest de métricas...');
    const digest = await generateMetricsDigest();
    const msg = digest?.mensagem_telegram || '📊 Nenhum dado disponível.';
    await sendTelegramMessage(chatId, msg);
    return;
  }

  // ─── /pausa — Pausar scheduler ───
  if (lower === '/pausa') {
    setPaused(true);
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['pause', msgId]);
    await sendTelegramMessage(chatId, '⏸️ Sistema pausado. Ciclos e inputs suspensos até /retomar.');
    return;
  }

  // ─── /retomar — Retomar scheduler ───
  if (lower === '/retomar') {
    setPaused(false);
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['resume', msgId]);
    await sendTelegramMessage(chatId, '▶️ Sistema retomado. Pronto para novos ciclos e inputs.');
    return;
  }

  // ─── /ok<code> — Aprovar sugestão ───
  const okMatch = lower.match(/^\/ok(\w{4})\b/);
  if (okMatch) {
    const code = okMatch[1];
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['approve', msgId]);
    const suggestions = queryObjects("SELECT id, keyword_used FROM suggestions WHERE id LIKE ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1", [code + '%']);
    if (suggestions.length === 0) {
      await sendTelegramMessage(chatId, '❌ Sugestão não encontrada ou já processada.');
      return;
    }
    const sug = suggestions[0];
    // Se for single_input, usa o fluxo novo com squads
    if (sug.keyword_used === 'single_input') {
      const result = await approveSingleInput(sug.id, chatId);
      await sendTelegramMessage(chatId, result.message);
    } else {
      // Fluxo antigo
      const result = await handleApprove(sug.id, chatId);
      await sendTelegramMessage(chatId, result.message);
    }
    return;
  }

  // ─── /no<code> — Rejeitar sugestão ───
  const noMatch = lower.match(/^\/no(\w{4})\b/);
  if (noMatch) {
    const code = noMatch[1];
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['reject', msgId]);
    const suggestions = queryObjects("SELECT id, keyword_used FROM suggestions WHERE id LIKE ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1", [code + '%']);
    if (suggestions.length === 0) {
      await sendTelegramMessage(chatId, '❌ Sugestão não encontrada.');
      return;
    }
    const sug = suggestions[0];
    if (sug.keyword_used === 'single_input') {
      const result = await rejectSingleInput(sug.id);
      await sendTelegramMessage(chatId, result.message);
    } else {
      const reply = await handleReject(sug.id, chatId);
      await sendTelegramMessage(chatId, reply);
    }
    return;
  }

  // ─── /ajustar_prompt_<code> — Botão Ajustar pressionado ───
  const ajustarPromptMatch = lower.match(/^\/ajustar_prompt_(\w{4})\b/);
  if (ajustarPromptMatch) {
    const code = ajustarPromptMatch[1];
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['adjust_prompt', msgId]);
    await sendTelegramMessage(chatId,
      `✏️ Digite o ajuste que deseja:\n\nEx: /ed${code} Mude o tom para mais informal e adicione uma chamada para ação no final`);
    return;
  }

  // ─── /ed<code> <texto> — Ajustar sugestão ───
  const edMatch = lower.match(/^\/ed(\w{4})\s+([\s\S]+)/);
  if (edMatch) {
    const code = edMatch[1];
    const instructions = edMatch[2].trim();
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['edit', msgId]);
    const suggestions = queryObjects("SELECT id FROM suggestions WHERE id LIKE ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1", [code + '%']);
    if (suggestions.length === 0) {
      await sendTelegramMessage(chatId, '❌ Sugestão não encontrada.');
      return;
    }
    const reply = await handleEdit(suggestions[0].id, instructions, chatId);
    await sendTelegramMessage(chatId, reply);
    return;
  }

  // ─── /publish_<id> — Publicar post pronto ───
  const publishMatch = lower.match(/^\/publish_(\S+)/);
  if (publishMatch) {
    const postId = publishMatch[1];
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['publish', msgId]);

    const post = queryOne('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!post) {
      await sendTelegramMessage(chatId, '❌ Post não encontrado.');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const today = new Date().toISOString().split('T')[0];

    runSql('UPDATE posts SET stage = ?, scheduled_date = ?, updated_at = ? WHERE id = ?',
      ['publicar', today, now, postId]);
    runSql(
      'INSERT INTO scheduled_publishes (id, post_id, platform, scheduled_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), postId, post.platform, today, 'pending', now]
    );

    logAction('telegram_publish', postId, 'Aprovado via Telegram');

    // Executa Squad5
    try {
      const content = JSON.parse(post.content || '{}');
      executeSquad(5, {
        post_id: postId, plataforma: post.platform,
        copy: content.copy || post.description,
        hashtags: JSON.parse(post.hashtags || '[]'),
        media: content.media || null
      });
    } catch {}

    await sendTelegramMessage(chatId, `🚀 Post publicado!\n📄 ${post.title}\n📱 ${post.platform}\n📊 Métricas em 24h.`);
    return;
  }

  // ─── /schedule_<id> <data> ───
  const scheduleMatch = text.match(/^\/schedule_(\S+)\s+(\S+)/);
  if (scheduleMatch) {
    const postId = scheduleMatch[1];
    const date = scheduleMatch[2];
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['schedule', msgId]);

    const post = queryOne('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!post) {
      await sendTelegramMessage(chatId, '❌ Post não encontrado.');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    runSql('UPDATE posts SET stage = ?, scheduled_date = ?, updated_at = ? WHERE id = ?',
      ['publicar', date, now, postId]);
    runSql(
      'INSERT INTO scheduled_publishes (id, post_id, platform, scheduled_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), postId, post.platform, date, 'pending', now]
    );

    logAction('telegram_schedule', postId, `Agendado para ${date}`);

    await sendTelegramMessage(chatId, `📅 Agendado!\n📄 ${post.title}\n📱 ${post.platform}\n📆 ${date}`);
    return;
  }

  // ─── /editfinal_<id> <texto> ───
  const editFinalMatch = text.match(/^\/editfinal_(\S+)\s+([\s\S]+)/);
  if (editFinalMatch) {
    const postId = editFinalMatch[1];
    const instructions = editFinalMatch[2].trim();
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['editfinal', msgId]);

    runSql('UPDATE posts SET stage = ?, updated_at = ? WHERE id = ?',
      ['editar', Math.floor(Date.now() / 1000), postId]);

    logAction('telegram_editfinal', postId, `Ajuste: ${instructions.substring(0, 100)}`);

    await sendTelegramMessage(chatId, `✏️ Ajustando: "${instructions.substring(0, 60)}..."`);

    startPipeline(postId, chatId).catch(err => {
      console.error('[Telegram] Erro pipeline:', err.message);
    });
    return;
  }

  // ─── /post <id> — Ver detalhes do post gerado ───
  if (lower === '/post' || lower.startsWith('/post ')) {
    const postId = text.length > 6 ? text.substring(6).trim() : '';
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['view_post', msgId]);

    if (!postId) {
      await sendTelegramMessage(chatId, 'Use /post <id> para ver detalhes.\nEx: /post a1b2c3d4');
      return;
    }

    const post = queryOne('SELECT * FROM posts WHERE id = ?', [postId]);
    if (post) {
      const content = (() => { try { return JSON.parse(post.content || '{}'); } catch { return {}; } })();
      const metrics = (() => { try { return JSON.parse(post.metrics || 'null'); } catch { return null; } })();
      const hashtags = (() => { try { return JSON.parse(post.hashtags || '[]'); } catch { return []; } })();
      const media = content.media || {};

      let msg = `━━━━━━━━━━━━━━━\n📄 ${post.title}\n━━━━━━━━━━━━━━━\n`;
      msg += `📱 ${post.platform} | 📌 ${post.stage}\n`;
      msg += `👤 ${post.assigned_to || '—'}\n`;
      if (post.published_date) msg += `📅 Publicado: ${post.published_date}\n`;
      msg += `\n📝 ${(content.copy || post.description || '').substring(0, 300)}\n`;
      if (hashtags.length) msg += `\n🏷️ ${hashtags.join(' ')}\n`;
      if (media.images?.length > 0) msg += `\n🖼️ ${media.images.length} imagem(ns) gerada(s)\n`;
      if (media.videoScript) msg += `🎬 Roteiro de vídeo gerado\n`;
      if (media.carousel) msg += `📑 Carrossel com ${media.carousel.slides?.length || 0} slides\n`;
      if (metrics) msg += `\n❤️ ${metrics.likes||0} 💬 ${metrics.comments||0} 🔁 ${metrics.shares||0} 👁️ ${metrics.reach||0}`;
      msg += '\n━━━━━━━━━━━━━━━';
      await sendTelegramMessage(chatId, msg);
    } else {
      const sug = queryOne("SELECT * FROM suggestions WHERE id LIKE ? ORDER BY created_at DESC LIMIT 1", [postId + '%']);
      if (sug) {
        const data = (() => { try { return JSON.parse(sug.content_generated || '{}'); } catch { return {}; } })();
        const media = data.media || {};
        let msg = `━━━━━━━━━━━━━━━\n💡 ${sug.title}\n━━━━━━━━━━━━━━━\n`;
        msg += `📱 ${sug.platform} | 📌 ${sug.status}\n`;
        msg += `\n📝 ${(data.squad4?.copy_final || data.squad3?.copy || sug.description || '').substring(0, 300)}\n`;
        if (media.images?.length > 0) msg += `\n🖼️ ${media.images.length} imagem(ns) gerada(s)\n`;
        if (media.videoScript) msg += `🎬 Roteiro de vídeo gerado\n`;
        msg += '\n━━━━━━━━━━━━━━━';
        await sendTelegramMessage(chatId, msg);
      } else {
        await sendTelegramMessage(chatId, '❌ Post não encontrado.');
      }
    }
    return;
  }

  // ─── /briefing <texto> ───
  if (lower.startsWith('/briefing')) {
    const briefingText = text.substring(9).trim();
    if (!briefingText) {
      await sendTelegramMessage(chatId, '❌ Envie o briefing.\nEx: /briefing Finalização de cachos tipo 3C');
      return;
    }
    const id = uuidv4();
    runSql('UPDATE briefings SET active = 0 WHERE active = 1');
    runSql(
      'INSERT INTO briefings (id, content, platform_focus, active, source, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)',
      [id, briefingText, 'instagram', 'telegram', Math.floor(Date.now()/1000), Math.floor(Date.now()/1000)]
    );
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['briefing', msgId]);
    await sendTelegramMessage(chatId, `✅ Briefing salvo!\n📋 "${briefingText.substring(0, 100)}${briefingText.length > 100 ? '...' : ''}"`);
    return;
  }

  // ─── /keyword <palavra> ───
  if (lower.startsWith('/keyword')) {
    const keyword = text.substring(8).trim();
    if (!keyword) {
      await sendTelegramMessage(chatId, '❌ Envie a keyword.\nEx: /keyword finalização cachos');
      return;
    }
    const id = uuidv4();
    runSql(
      'INSERT INTO research_keywords (id, keyword, active, created_at) VALUES (?, ?, 1, ?)',
      [id, keyword, Math.floor(Date.now()/1000)]
    );
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['keyword', msgId]);
    await sendTelegramMessage(chatId, `✅ Keyword adicionada: "${keyword}"`);
    return;
  }

  // ─── /status — Status executivo ───
  if (lower === '/status' || lower === '/start') {
    runSql('UPDATE telegram_messages SET processed = 1 WHERE id = ?', [msgId]);

    const summary = await getStatusSummary();
    const paused = isCyclePaused();
    const cycle = getActiveCycle();

    const socialMissing = !require('../config').instagram.appId;
    const geminiOk = !!require('../config').gemini.apiKey;

    let msg = '━━━━━━━━━━━━━━━\n';
    msg += '🤖 CACHOVIVA STATUS\n';
    msg += '━━━━━━━━━━━━━━━\n';
    msg += paused ? '⏸️ PAUSADO\n' : '🟢 ATIVO\n';
    if (cycle) {
      const statusMap = { planning: '📋 Planejando', awaiting_approval: '⏳ Aguardando aprovação', approved: '✅ Aprovado', rejected: '❌ Rejeitado', error: '⚠️ Erro' };
      msg += `${statusMap[cycle.status] || cycle.status}\n`;
    }
    msg += geminiOk ? '🤖 Gemini: OK\n' : '🤖 Gemini: ⚠️ Sem chave\n';
    msg += socialMissing ? '🔌 Redes sociais: ❌ Não configuradas\n' : '🔌 Redes sociais: OK\n';
    msg += `\n📌 Envie qualquer ideia → pipeline completa com IA\n`;
    msg += '━━━━━━━━━━━━━━━';

    await sendTelegramMessage(chatId, msg);
    return;
  }

  // ─── /stats — Estatísticas de leads por diagnóstico ───
  if (lower === '/stats') {
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['stats', msgId]);
    try {
      const allLeads = queryObjects("SELECT diagnosis_name, COUNT(*) as total FROM leads WHERE diagnosis_name != '' GROUP BY diagnosis_name ORDER BY total DESC");
      const totalLeads = queryOne('SELECT COUNT(*) as total FROM leads');
      const total = totalLeads?.total || 0;
      const kitCount = queryOne("SELECT COUNT(*) as total FROM leads WHERE kit_interest = 1");
      const interests = kitCount?.total || 0;

      const displayMap = {
        "Cabelo Equilibrado": "Cacho Equilibrado",
        "Cabelo Ressaca": "Cacho Proteico",
        "Cabelo Sedento": "Cacho Sedento",
        "Cabelo Pesado": "Cacho Nutrido",
        "Cabelo Poroso": "Cacho Poroso",
        "Cabelo sem Rotina": "Cacho que Precisa de Ritual"
      };

      let msg = '📊 *CachoViva — Leads por perfil*\n\n';
      allLeads.forEach(function(r) {
        var pct = total > 0 ? Math.round((r.total / total) * 100) : 0;
        var bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.min(Math.floor(pct / 10), 10));
        var name = displayMap[r.diagnosis_name] || r.diagnosis_name;
        msg += '*' + name + '*\n' + bar + ' ' + r.total + ' (' + pct + '%)\n\n';
      });
      msg += '─────────────────\n';
      msg += '👥 Total: ' + total + '\n';
      msg += '🔥 Interesse no kit: ' + interests + '\n';
      msg += '📈 Taxa de interesse: ' + (total > 0 ? Math.round((interests / total) * 100) : 0) + '%';

      await sendTelegramMessage(chatId, msg);
    } catch (err) {
      await sendTelegramMessage(chatId, '❌ Erro ao buscar stats: ' + err.message);
    }
    return;
  }

  // ─── /lead_<id> — Ver detalhes completos de um lead ───
  const leadDetailMatch = text.match(/^\/lead_(\S+)/);
  if (leadDetailMatch) {
    const leadId = leadDetailMatch[1];
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['lead_detail', msgId]);
    const lead = queryOne('SELECT * FROM leads WHERE id = ?', [leadId]);
    if (!lead) {
      await sendTelegramMessage(chatId, '❌ Lead não encontrado.');
      return;
    }
    const scores = (() => { try { return JSON.parse(lead.scores || '{}'); } catch { return {}; } })();
    const answers = (() => { try { return JSON.parse(lead.answers || '[]'); } catch { return []; } })();
    const diagnosisNames = { '1a': '1A - Liso', '1b': '1B - Liso', '1c': '1C - Liso', '2a': '2A - Ondulado', '2b': '2B - Ondulado', '2c': '2C - Ondulado', '3a': '3A - Cacheado', '3b': '3B - Cacheado', '3c': '3C - Cacheado', '4a': '4A - Crespo', '4b': '4B - Crespo', '4c': '4C - Crespo' };
    const dateStr = new Date((lead.created_at || 0) * 1000).toLocaleString('pt-BR');

    let msg = `━━━━━━━━━━━━━━━\n👤 *${lead.name}*\n━━━━━━━━━━━━━━━\n`;
    msg += `📞 ${lead.phone}\n`;
    msg += `📧 ${lead.email || '—'}\n`;
    msg += `📋 Diagnóstico: *${diagnosisNames[lead.diagnosis] || lead.diagnosis_name || lead.diagnosis}*\n`;
    msg += `📅 ${dateStr}\n`;
    if (lead.kit_interest) msg += `🛍️ *Interesse no Kit Lançamento!*\n`;
    msg += `\n📊 *Scores:*\n`;
    for (const [key, val] of Object.entries(scores)) {
      msg += `  • ${key}: ${val}\n`;
    }
    if (answers.length > 0) {
      msg += `\n📝 *Respostas:*\n`;
      answers.forEach((a, i) => {
        const q = typeof a === 'object' ? (a.question || a.q || `Pergunta ${i + 1}`) : `Pergunta ${i + 1}`;
        const r = typeof a === 'object' ? (a.answer || a.a || a) : a;
        msg += `  ${i + 1}. ${q}: ${r}\n`;
      });
    }
    msg += '━━━━━━━━━━━━━━━';
    await sendTelegramMessage(chatId, msg);
    return;
  }

  // ─── /list — Listar leads com paginação e filtro por diagnóstico ───
  // Formatos: /list, /list_p0, /list sedento, /list_p0 sedento
  const listMatch = text.match(/^\/list(?:_p(\d+))?(?:\s+(.+))?$/i);
  if (listMatch) {
    const page = parseInt(listMatch[1] || '0', 10);
    let filter = (listMatch[2] || '').trim().toLowerCase();
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['list_leads', msgId]);

    const filterClause = filter !== ''
      ? "WHERE LOWER(diagnosis_name) LIKE '%' || ? || '%' OR LOWER(diagnosis) LIKE '%' || ? || '%'"
      : '';
    const params = filter !== '' ? [filter, filter] : [];

    const countRow = queryOne(
      'SELECT COUNT(*) as total FROM leads ' + filterClause,
      params.length > 0 ? params : undefined
    );
    const totalLeads = countRow?.total || 0;
    if (totalLeads === 0) {
      await sendTelegramMessage(chatId, filter !== ''
        ? '📭 Nenhum lead encontrado com o perfil "' + listMatch[2] + '".'
        : '📭 Nenhum lead cadastrado ainda.');
      return;
    }

    const PER_PAGE = 5;
    const totalPages = Math.ceil(totalLeads / PER_PAGE);
    const currentPage = Math.min(page, totalPages - 1);
    const start = currentPage * PER_PAGE;

    const allLeads = queryObjects(
      'SELECT id, name, phone, diagnosis, diagnosis_name, created_at, kit_interest FROM leads ' + filterClause + ' ORDER BY created_at DESC LIMIT ' + PER_PAGE + ' OFFSET ' + start,
      params.length > 0 ? params : undefined
    );

    const diagnosisNames = { '1a': '1A - Liso', '1b': '1B - Liso', '1c': '1C - Liso', '2a': '2A - Ondulado', '2b': '2B - Ondulado', '2c': '2C - Ondulado', '3a': '3A - Cacheado', '3b': '3B - Cacheado', '3c': '3C - Cacheado', '4a': '4A - Crespo', '4b': '4B - Crespo', '4c': '4C - Crespo' };
    const suffix = filter !== '' ? ' • Filtro: ' + listMatch[2] : '';
    let msg = '📋 *Leads CachoViva* (página ' + (currentPage + 1) + '/' + totalPages + ')' + suffix + '\n\n';

    allLeads.forEach(function(l, i) {
      var num = start + i + 1;
      var dName = diagnosisNames[l.diagnosis] || l.diagnosis_name || l.diagnosis || '—';
      var kit = l.kit_interest ? ' 🛍️' : '';
      msg += num + '. *' + l.name + '*' + kit + '\n   📞 ' + l.phone + ' | 📋 ' + dName + '\n';
    });

    const buttons = [];
    allLeads.forEach(function(l) {
      buttons.push([{ text: '👤 ' + l.name, callback_data: '/lead_' + l.id }]);
    });

    const filterParam = filter !== '' ? ' ' + listMatch[2] : '';
    const navRow = [];
    if (currentPage > 0) {
      navRow.push({ text: '◀️ Anterior', callback_data: '/list_p' + (currentPage - 1) + filterParam });
    }
    navRow.push({ text: (currentPage + 1) + '/' + totalPages, callback_data: '/list_current' });
    if (currentPage < totalPages - 1) {
      navRow.push({ text: '▶️ Próximo', callback_data: '/list_p' + (currentPage + 1) + filterParam });
    }
    if (navRow.length > 0) buttons.push(navRow);

    await sendTelegramMessage(chatId, msg, buttons);
    return;
  }

  // ─── /list_current — no-op (botão de indicador de página) ───
  if (lower === '/list_current') {
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['list_current', msgId]);
    await sendTelegramMessage(chatId, `📍 Você está nesta página. Use ◀️ e ▶️ para navegar.`);
    return;
  }

  // ─── CATCH-ALL: comando desconhecido começando com / ───
  if (lower.startsWith('/')) {
    runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['unknown_cmd', msgId]);
    await sendTelegramMessage(chatId,
      '❓ Comando não reconhecido.\n\n' +
      'Comandos disponíveis:\n' +
      '🔹 /list — Listar leads (use /list sedento p/ filtrar)\n' +
      '🔹 /stats — Estatísticas de leads por perfil\n' +
      '🔹 /post <id> — Ver detalhes de um post\n' +
      '🔹 /briefing <texto> — Definir briefing\n' +
      '🔹 /keyword <palavra> — Adicionar keyword\n' +
      '🔹 /metricas — Ver métricas\n' +
      '🔹 /status — Status do sistema\n' +
      '🔹 /pausa — Pausar sistema\n' +
      '🔹 /retomar — Retomar sistema\n\n' +
      '📌 Qualquer outra mensagem será processada como novo conteúdo pela IA.');
    return;
  }

  // ─── LIVRE: tratar como novo input → pipeline completa ───
  runSql('UPDATE telegram_messages SET processed = 1, message_type = ? WHERE id = ?', ['single_input', msgId]);

  // Feedback imediato
  await sendTelegramMessage(chatId, `🧠 Processando "${text.substring(0, 40)}..." via Squads IA...`);

  // Dispara pipeline completa (Squad2 → 3 → Media → 4 → aprovação)
  processSingleInput(text, chatId).then(result => {
    if (result?.message) {
      // Mensagem já foi enviada pelo notifyCallback dentro da função
      console.log(`[Telegram] Input processado: ${result.suggestionId}`);
    }
  }).catch(err => {
    console.error('[Telegram] Erro no pipeline:', err.message);
    sendTelegramMessage(chatId, `❌ Erro ao processar: ${err.message}`).catch(() => {});
  });
}

function formatTelegramMessage(text) {
  if (!text) return '';
  let lines = text.split('\n');
  if (lines.length > 20) {
    lines = lines.slice(0, 18);
    lines.push('...');
  }
  return lines.join('\n');
}

async function sendTelegramMessage(chatId, text, keyboard = null) {
  const cfg = getConfigAny();
  if (!cfg?.bot_token) return;
  const formatted = formatTelegramMessage(text);
  const payload = { chat_id: chatId, text: formatted };
  if (keyboard) {
    payload.reply_markup = { inline_keyboard: keyboard };
  }
  try {
    await axios.post(`https://api.telegram.org/bot${cfg.bot_token}/sendMessage`, payload, { timeout: 10000 });
  } catch (err) {
    console.error('[Telegram] Erro ao enviar mensagem:', err.message);
  }
}

async function sendTelegramPhoto(chatId, imageBase64OrUrl, caption = '', keyboard = null) {
  const cfg = getConfigAny();
  if (!cfg?.bot_token) return;

  try {
    let buffer = null;
    let ext = 'jpg';

    if (imageBase64OrUrl.startsWith('data:')) {
      const matches = imageBase64OrUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        console.error('[Telegram] Formato base64 invalido para imagem:', imageBase64OrUrl.substring(0, 80));
        throw new Error('Formato base64 invalido');
      }
      ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      buffer = Buffer.from(matches[2], 'base64');
      console.log(`[Telegram] Imagem base64 decodificada: ${(buffer.length / 1024).toFixed(1)} KB, formato ${ext}`);
    } else if (imageBase64OrUrl.startsWith('http')) {
      const resp = await axios.get(imageBase64OrUrl, { responseType: 'arraybuffer' });
      buffer = Buffer.from(resp.data);
      console.log(`[Telegram] Imagem URL baixada: ${(buffer.length / 1024).toFixed(1)} KB`);
    } else {
      console.error('[Telegram] Formato de imagem desconhecido:', imageBase64OrUrl.substring(0, 80));
      throw new Error('Formato de imagem desconhecido');
    }

    if (!buffer || buffer.length < 100) {
      throw new Error(`Buffer da imagem muito pequeno: ${buffer?.length || 0} bytes`);
    }

    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
    const filePath = path.join(TEMP_DIR, `img_${Date.now()}.${ext}`);
    fs.writeFileSync(filePath, buffer);
    console.log(`[Telegram] Arquivo salvo: ${filePath} (${buffer.length} bytes)`);

    let FormData;
    try { FormData = require('form-data'); } catch { FormData = null; }
    console.log(`[Telegram] form-data disponivel: ${!!FormData}`);

    if (FormData) {
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('photo', fs.createReadStream(filePath));
      if (caption) form.append('caption', formatTelegramMessage(caption));
      if (keyboard) {
        form.append('reply_markup', JSON.stringify({ inline_keyboard: keyboard }));
      }
      const resp = await axios.post(`https://api.telegram.org/bot${cfg.bot_token}/sendPhoto`, form, {
        headers: form.getHeaders(),
        timeout: 30000
      });
      console.log('[Telegram] Foto enviada com sucesso (form-data)');
    } else {
      console.log('[Telegram] Usando fallback multipart nativo...');
      const boundary = '----FormBoundary' + Date.now();
      let body = '';
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`;
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="photo"; filename="image.${ext}"\r\n`;
      body += `Content-Type: image/${ext}\r\n\r\n`;
      if (caption) {
        body += `\r\n--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="caption"\r\n\r\n${formatTelegramMessage(caption)}\r\n`;
      }
      if (keyboard) {
        body += `\r\n--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="reply_markup"\r\n\r\n${JSON.stringify({ inline_keyboard: keyboard })}\r\n`;
      }
      const bodyStart = Buffer.from(body);
      const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`);
      const finalBuffer = Buffer.concat([bodyStart, buffer, bodyEnd]);
      const resp = await axios.post(
        `https://api.telegram.org/bot${cfg.bot_token}/sendPhoto`,
        finalBuffer,
        {
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': finalBuffer.length
          },
          timeout: 30000
        }
      );
      console.log('[Telegram] Foto enviada com sucesso (fallback multipart)');
    }

    try { fs.unlinkSync(filePath); } catch {}
  } catch (err) {
    console.error('[Telegram] Erro ao enviar foto:', err.message);
    if (err.response?.data) {
      console.error('[Telegram] Resposta da API:', JSON.stringify(err.response.data));
    }
    if (caption) await sendTelegramMessage(chatId, caption, keyboard);
  }
}

// Envia aprovação com foto + texto + botões
async function sendApproval(chatId, text, code, mediaOutput) {
  const buttons = [
    [
      { text: '✅ Aprovar', callback_data: `/ok${code}` },
      { text: '✏️ Ajustar', callback_data: `/ajustar_prompt_${code}` },
      { text: '❌ Rejeitar', callback_data: `/no${code}` }
    ]
  ];

  console.log(`[Telegram] sendApproval: ${mediaOutput?.images?.length || 0} imagens, code=${code}`);

  // Se tem imagem, envia foto com caption + botões
  if (mediaOutput?.images?.length > 0) {
    const firstImage = mediaOutput.images[0];
    console.log(`[Telegram] Primeira imagem URL: ${(firstImage.url || '').substring(0, 80)}...`);
    try {
      await sendTelegramPhoto(chatId, firstImage.url, text, buttons);
    } catch (e) {
      console.error('[Telegram] Erro sendTelegramPhoto:', e.message);
      await sendTelegramMessage(chatId, text, buttons);
    }
  } else {
    console.log('[Telegram] Nenhuma imagem, enviando apenas texto');
    await sendTelegramMessage(chatId, text, buttons);
  }
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

async function sendToTelegram(text, keyboard = null) {
  const cfg = getConfigAny();
  if (!cfg?.bot_token || !cfg?.chat_id) return;
  await sendTelegramMessage(cfg.chat_id, text, keyboard);
}

function logAction(action, postId, details) {
  runSql(
    'INSERT INTO automation_log (id, action, post_id, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), action, postId || '', details, 'success', Math.floor(Date.now() / 1000)]
  );
}

module.exports = {
  startPolling, stopPolling, sendToTelegram,
  sendTelegramMessage, sendTelegramPhoto, sendApproval,
  processTelegramMessage
};
