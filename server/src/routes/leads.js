const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { sendToTelegram } = require('../services/telegram');
const { sendDiagnosisEmail } = require('../services/email');

function initLeadsTable() {
  db.runSql(`CREATE TABLE IF NOT EXISTS leads (
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
  try { db.runSql(`ALTER TABLE leads ADD COLUMN kit_interest INTEGER DEFAULT 0`); } catch (e) { /* coluna já existe */ }
}

initLeadsTable();

router.post('/', (req, res) => {
  try {
    const { name, phone, email, diagnosis, diagnosis_name, scores, answers, diagnosis_details } = req.body;

    if (!name || !phone || !diagnosis) {
      return res.status(400).json({ error: 'Campos obrigatórios: name, phone, diagnosis' });
    }

    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    const ok = db.runSql(
      `INSERT INTO leads (id, name, phone, email, diagnosis, diagnosis_name, scores, answers, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, phone, email, diagnosis, diagnosis_name || '', JSON.stringify(scores || {}), JSON.stringify(answers || []), now]
    );

    if (!ok) {
      return res.status(500).json({ error: 'Erro ao salvar lead' });
    }

    const msg = `🆕 *Nova Lead CachoViva!*\n\n👤 *${name}*\n📞 ${phone}\n📧 ${email}\n📋 Diagnóstico: *${diagnosis_name || diagnosis}*\n📊 Scores: ${JSON.stringify(scores || {})}`;
    sendToTelegram(msg).catch(() => {});

    // Enviar e-mail com o diagnóstico
    if (email && diagnosis_details) {
      sendDiagnosisEmail({ to: email, name, diagnosis: diagnosis_details }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      lead: { id, name, phone, email, diagnosis, diagnosis_name, scores },
    });
  } catch (err) {
    console.error('[Leads] Erro:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/', (req, res) => {
  try {
    const leads = db.queryObjects('SELECT * FROM leads ORDER BY created_at DESC');
    res.json(leads.map(l => ({
      ...l,
      scores: JSON.parse(l.scores || '{}'),
      answers: JSON.parse(l.answers || '[]'),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/count', (req, res) => {
  try {
    const row = db.queryOne('SELECT COUNT(*) as total FROM leads');
    res.json({ total: row?.total || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/kit', (req, res) => {
  try {
    const { id } = req.params;
    const lead = db.queryOne('SELECT * FROM leads WHERE id = ?', [id]);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrada' });

    db.runSql('UPDATE leads SET kit_interest = 1 WHERE id = ?', [id]);

    const msg = `🛍️ *INTERESSE NO KIT!*\n\n👤 *${lead.name}*\n📞 ${lead.phone}\n📧 ${lead.email}\n📋 Diagnóstico: *${lead.diagnosis_name || lead.diagnosis}*\n\nQuer comprar o Kit Lançamento!`;
    sendToTelegram(msg).catch(() => {});

    res.json({ success: true, message: 'Interesse registrado!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
