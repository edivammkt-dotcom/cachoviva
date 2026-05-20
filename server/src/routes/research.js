const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryObjects, queryOne, runSql } = require('../database');
const { optionalAuth } = require('../middleware/auth');
const ContentAI = require('../services/ai');
const { approveSuggestion, rejectSuggestion, runAutomatedResearch } = require('../services/researchScheduler');

const router = express.Router();
const contentAI = new ContentAI();

// === BRIEFING ===
router.get('/briefings', optionalAuth, (req, res) => {
  try {
    const briefings = queryObjects('SELECT * FROM briefings ORDER BY created_at DESC');
    res.json({ success: true, briefings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/briefings/active', optionalAuth, (req, res) => {
  try {
    const briefing = queryOne('SELECT * FROM briefings WHERE active = 1 ORDER BY created_at DESC LIMIT 1');
    res.json({ success: true, briefing: briefing || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/briefings', optionalAuth, (req, res) => {
  try {
    const { content, platform_focus } = req.body;
    if (!content) return res.status(400).json({ error: 'Conteudo do briefing obrigatorio' });
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    runSql('UPDATE briefings SET active = 0 WHERE active = 1');
    runSql('INSERT INTO briefings (id, content, platform_focus, active, source, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)',
      [id, content, platform_focus || 'instagram', 'manual', now, now]);
    const briefing = queryOne('SELECT * FROM briefings WHERE id = ?', [id]);
    res.json({ success: true, briefing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/briefings/:id', optionalAuth, (req, res) => {
  try {
    const { content, platform_focus, active } = req.body;
    const now = Math.floor(Date.now() / 1000);
    if (active === 1) {
      runSql('UPDATE briefings SET active = 0 WHERE active = 1 AND id != ?', [req.params.id]);
    }
    runSql('UPDATE briefings SET content = COALESCE(?, content), platform_focus = COALESCE(?, platform_focus), active = COALESCE(?, active), updated_at = ? WHERE id = ?',
      [content || null, platform_focus || null, active ?? null, now, req.params.id]);
    const briefing = queryOne('SELECT * FROM briefings WHERE id = ?', [req.params.id]);
    res.json({ success: true, briefing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/briefings/:id', optionalAuth, (req, res) => {
  try {
    runSql('DELETE FROM briefings WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === KEYWORDS ===
router.get('/keywords', optionalAuth, (req, res) => {
  try {
    const keywords = queryObjects('SELECT * FROM research_keywords ORDER BY created_at DESC');
    res.json({ success: true, keywords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/keywords', optionalAuth, (req, res) => {
  try {
    const { keyword, schedule_cron } = req.body;
    if (!keyword) return res.status(400).json({ error: 'Keyword obrigatoria' });
    const id = uuidv4();
    runSql('INSERT INTO research_keywords (id, keyword, active, schedule_cron, created_at) VALUES (?, ?, 1, ?, ?)',
      [id, keyword, schedule_cron || '0 8,14 * * 1-5', Math.floor(Date.now() / 1000)]);
    const kw = queryOne('SELECT * FROM research_keywords WHERE id = ?', [id]);
    res.json({ success: true, keyword: kw });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/keywords/:id', optionalAuth, (req, res) => {
  try {
    const { keyword, active, schedule_cron } = req.body;
    runSql('UPDATE research_keywords SET keyword = COALESCE(?, keyword), active = COALESCE(?, active), schedule_cron = COALESCE(?, schedule_cron) WHERE id = ?',
      [keyword || null, active ?? null, schedule_cron || null, req.params.id]);
    const kw = queryOne('SELECT * FROM research_keywords WHERE id = ?', [req.params.id]);
    res.json({ success: true, keyword: kw });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/keywords/:id', optionalAuth, (req, res) => {
  try {
    runSql('DELETE FROM research_keywords WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === SUGGESTIONS ===
router.get('/suggestions', optionalAuth, (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM suggestions';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    const suggestions = queryObjects(sql, params).map(s => {
      try { s.hashtags = JSON.parse(s.hashtags || '[]'); } catch { s.hashtags = []; }
      return s;
    });
    res.json({ success: true, suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/suggestions/:id/approve', optionalAuth, async (req, res) => {
  try {
    const post = await approveSuggestion(req.params.id);
    if (!post) return res.status(400).json({ error: 'Sugestao nao encontrada ou ja processada' });
    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/suggestions/:id/reject', optionalAuth, async (req, res) => {
  try {
    await rejectSuggestion(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === RESEARCH TRIGGER ===
router.post('/trigger', optionalAuth, async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: 'Keyword obrigatoria' });
    const count = await runAutomatedResearch(false);
    res.json({ success: true, suggestionsCreated: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === TELEGRAM CONFIG ===
router.get('/telegram/config', optionalAuth, (req, res) => {
  try {
    const cfg = queryObjects('SELECT id, chat_id, enabled, last_offset, created_at FROM telegram_config ORDER BY created_at DESC LIMIT 1');
    res.json({ success: true, config: cfg.length > 0 ? cfg[0] : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/telegram/config', optionalAuth, (req, res) => {
  try {
    const { bot_token, chat_id } = req.body;
    if (!bot_token) return res.status(400).json({ error: 'Token do bot obrigatorio' });
    const now = Math.floor(Date.now() / 1000);
    const existing = queryOne('SELECT id FROM telegram_config ORDER BY created_at DESC LIMIT 1');
    if (existing) {
      runSql('UPDATE telegram_config SET bot_token = ?, chat_id = ?, enabled = 1, updated_at = ? WHERE id = ?',
        [bot_token, chat_id || '', now, existing.id]);
    } else {
      const id = uuidv4();
      runSql('INSERT INTO telegram_config (id, bot_token, chat_id, enabled, last_offset, created_at, updated_at) VALUES (?, ?, ?, 1, 0, ?, ?)',
        [id, bot_token, chat_id || '', now, now]);
    }
    const cfg = queryObjects('SELECT id, chat_id, enabled, created_at FROM telegram_config ORDER BY created_at DESC LIMIT 1');
    res.json({ success: true, config: cfg[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/telegram/config', optionalAuth, (req, res) => {
  try {
    runSql('DELETE FROM telegram_config');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/telegram/messages', optionalAuth, (req, res) => {
  try {
    const messages = queryObjects('SELECT * FROM telegram_messages ORDER BY created_at DESC LIMIT 50');
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;