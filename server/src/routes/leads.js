const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { sendToTelegram } = require('../services/telegram');
const { sendDiagnosisEmail } = require('../services/email');

try { db.runSql(`ALTER TABLE leads ADD COLUMN kit_interest INTEGER DEFAULT 0`); } catch (e) {}

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

    // Monta resumo do diagnóstico
    const labelMap = { H: 'Hidratação', N: 'Nutrição', R: 'Reconstrução', P: 'Porosidade' };
    var scoresLinhas = Object.entries(labelMap).map(function(e) {
      return '▸ ' + e[1] + ': ' + ((scores && scores[e[0]]) || 0);
    }).join('\n');
    var maior = '';
    var maiorValor = -1;
    Object.keys(labelMap).forEach(function(k) {
      var v = (scores && scores[k]) || 0;
      if (v > maiorValor) { maiorValor = v; maior = labelMap[k]; }
    });
    var resumo = '📋 *Diagnóstico:* ' + (diagnosis_name || diagnosis || '—');
    resumo += '\n📊 *Scores:*\n' + scoresLinhas;
    if (maior) resumo += '\n🔍 *Principal necessidade:* ' + maior;

    const msg = '🆕 *Nova Lead CachoViva!*\n\n' +
      '👤 *' + name + '*\n' +
      '📞 ' + phone + '\n' +
      '📧 ' + (email || '—') + '\n\n' +
      resumo;
    const buttons = [[{ text: '📋 Ver lead', callback_data: `/lead_${id}` }]];
    sendToTelegram(msg, buttons).catch(() => {});

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

router.get('/:id/confirmar-lista', (req, res) => {
  try {
    const { id } = req.params;
    const lead = db.queryOne('SELECT * FROM leads WHERE id = ?', [id]);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrada' });

    db.runSql('UPDATE leads SET kit_interest = 1 WHERE id = ?', [id]);

    // Monta resumo do diagnóstico
    const scores = JSON.parse(lead.scores || '{}');
    const labelMap = { H: 'Hidratação', N: 'Nutrição', R: 'Reconstrução', P: 'Porosidade' };
    var scoresLinhas = Object.entries(labelMap).map(function(e) {
      return '▸ ' + e[1] + ': ' + (scores[e[0]] || 0);
    }).join('\n');

    // Encontra a maior necessidade (exclui B)
    var maior = '';
    var maiorValor = -1;
    Object.keys(labelMap).forEach(function(k) {
      var v = scores[k] || 0;
      if (v > maiorValor) { maiorValor = v; maior = labelMap[k]; }
    });

    var resumo = '📋 *Diagnóstico:* ' + (lead.diagnosis_name || lead.diagnosis || '—');
    if (scoresLinhas) resumo += '\n📊 *Scores:*\n' + scoresLinhas;
    if (maior) resumo += '\n🔍 *Principal necessidade:* ' + maior;

    const msg = '🛍️ *NOVO NA LISTA VIP!*\n\n' +
      '👤 *' + lead.name + '*\n' +
      '📞 ' + lead.phone + '\n' +
      '📧 ' + (lead.email || '—') + '\n\n' +
      resumo + '\n\n' +
      'Entrou na lista de espera do lançamento!';

    const buttons = [[{ text: '📋 Ver lead', callback_data: `/lead_${id}` }]];
    sendToTelegram(msg, buttons).catch(() => {});

    res.json({ success: true, message: 'Confirmado na lista VIP!' });
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

    const msg = `🛍️ *INTERESSE NO KIT!*\n\n👤 *${lead.name}*\n📞 ${lead.phone}\n📧 ${lead.email || '—'}\n📋 Diagnóstico: *${lead.diagnosis_name || lead.diagnosis}*\n\nQuer comprar o Kit Lançamento!`;
    const buttons = [[{ text: '📋 Ver lead', callback_data: `/lead_${id}` }]];
    sendToTelegram(msg, buttons).catch(() => {});

    res.json({ success: true, message: 'Interesse registrado!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mapeamento de diagnosis_name interno → nome de exibição (mesmo do frontend)
const diagnosisDisplayMap = {
  "Cabelo Equilibrado": "Cacho Equilibrado",
  "Cabelo Ressaca": "Cacho Proteico",
  "Cabelo Sedento": "Cacho Sedento",
  "Cabelo Pesado": "Cacho Nutrido",
  "Cabelo Poroso": "Cacho Poroso",
  "Cabelo sem Rotina": "Cacho em Descoberta",
};

router.get('/counters', (req, res) => {
  try {
    const rows = db.queryObjects(
      "SELECT diagnosis_name, COUNT(*) as total FROM leads WHERE diagnosis_name != '' GROUP BY diagnosis_name"
    );
    const counters = {};
    rows.forEach(function(r) {
      var displayName = diagnosisDisplayMap[r.diagnosis_name] || r.diagnosis_name;
      counters[displayName] = (counters[displayName] || 0) + r.total;
    });
    res.json(counters);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/counters/:diagnostico', (req, res) => {
  res.json({ success: true });
});

router.delete('/all', (req, res) => {
  try {
    db.runSql('DELETE FROM leads');
    res.json({ success: true, message: 'Todos os leads foram removidos' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
