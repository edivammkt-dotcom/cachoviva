const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryObjects, queryOne, runSql, prepareStmt } = require('../database');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, (req, res) => {
  try {
    const { stage, platform } = req.query;
    let sql = 'SELECT * FROM posts';
    const params = [];
    const conditions = [];
    if (stage) { conditions.push('stage = ?'); params.push(stage); }
    if (platform) { conditions.push('platform = ?'); params.push(platform); }
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY updated_at DESC';
    const posts = queryObjects(sql, params).map(parsePost);
    res.json(posts);
  } catch (err) {
    console.error('Get posts error:', err);
    res.status(500).json({ error: 'Erro ao buscar posts' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const post = queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    res.json(parsePost(post));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar post' });
  }
});

router.post('/', optionalAuth, (req, res) => {
  try {
    const { title, description, platform, stage, assigned_to, content, hashtags, scheduled_date } = req.body;
    if (!title) return res.status(400).json({ error: 'Título é obrigatório' });
    const id = req.body.id || uuidv4();
    const now = Math.floor(Date.now() / 1000);
    runSql('INSERT INTO posts (id, title, description, platform, stage, assigned_to, content, hashtags, scheduled_date, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, description||'', platform||'instagram', stage||'pesquisar', assigned_to||'', content||'', JSON.stringify(hashtags||[]), scheduled_date||'', now, now, req.user?.id||null]);
    const post = queryOne('SELECT * FROM posts WHERE id = ?', [id]);
    res.status(201).json(parsePost(post));
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Erro ao criar post' });
  }
});

router.put('/:id', optionalAuth, (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Post não encontrado' });
    const { title, description, platform, stage, assigned_to, content, hashtags, scheduled_date, metrics, feedback } = req.body;
    const now = Math.floor(Date.now() / 1000);
    runSql(`UPDATE posts SET title=COALESCE(?,title), description=COALESCE(?,description), platform=COALESCE(?,platform), stage=COALESCE(?,stage), assigned_to=COALESCE(?,assigned_to), content=COALESCE(?,content), hashtags=COALESCE(?,hashtags), scheduled_date=COALESCE(?,scheduled_date), metrics=COALESCE(?,metrics), feedback=COALESCE(?,feedback), updated_at=? WHERE id=?`,
      [title||null, description??null, platform||null, stage||null, assigned_to??null, content??null, hashtags?JSON.stringify(hashtags):null, scheduled_date??null, metrics?JSON.stringify(metrics):null, feedback?JSON.stringify(feedback):null, now, req.params.id]);
    const post = queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    res.json(parsePost(post));
  } catch (err) {
    console.error('Update post error:', err);
    res.status(500).json({ error: 'Erro ao atualizar post' });
  }
});

router.delete('/:id', optionalAuth, (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Post não encontrado' });
    runSql('DELETE FROM posts WHERE id = ?', [req.params.id]);
    res.json({ message: 'Post excluído' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir post' });
  }
});

router.post('/:id/stage', optionalAuth, (req, res) => {
  try {
    const { stage, assigned_to } = req.body;
    const post = queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    const stages = ['pesquisar','planejar','criar','editar','validar','aprovar','publicar','medir'];
    if (!stages.includes(stage)) return res.status(400).json({ error: 'Etapa inválida' });
    const now = Math.floor(Date.now() / 1000);
    runSql('UPDATE posts SET stage=?, assigned_to=COALESCE(?, assigned_to), updated_at=? WHERE id=?',
      [stage, assigned_to||null, now, req.params.id]);
    logAutomation('stage_set', req.params.id, `Etapa definida para ${stage}`);
    const updated = queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    res.json(parsePost(updated));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao definir etapa' });
  }
});

router.post('/:id/advance', optionalAuth, (req, res) => {
  try {
    const post = queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    const stages = ['pesquisar','planejar','criar','editar','validar','aprovar','publicar','medir'];
    const idx = stages.indexOf(post.stage);
    if (idx === -1 || idx >= stages.length - 1) return res.status(400).json({ error: 'Post não pode avançar' });
    const nextStage = stages[idx + 1];
    const team = queryOne('SELECT name FROM team_members WHERE stage = ?', [nextStage]);
    const now = Math.floor(Date.now() / 1000);
    runSql('UPDATE posts SET stage=?, assigned_to=?, updated_at=? WHERE id=?', [nextStage, team?.name||'', now, req.params.id]);
    logAutomation('advance', req.params.id, `Avançou para ${nextStage}`);
    const updated = queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    res.json(parsePost(updated));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao avançar post' });
  }
});

router.post('/:id/feedback', optionalAuth, (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Texto do feedback é obrigatório' });
    const post = queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    const feedback = JSON.parse(post.feedback||'[]');
    feedback.push({ text, by: req.user?.name||'Sistema', date: new Date().toLocaleDateString('pt-BR') });
    const editor = queryOne('SELECT name FROM team_members WHERE stage = ?', ['editar']);
    const now = Math.floor(Date.now() / 1000);
    runSql('UPDATE posts SET stage=?, assigned_to=?, feedback=?, updated_at=? WHERE id=?', ['editar', editor?.name||'', JSON.stringify(feedback), now, req.params.id]);
    logAutomation('feedback', req.params.id, `Feedback enviado`);
    const updated = queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    res.json(parsePost(updated));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao enviar feedback' });
  }
});

router.post('/:id/publish', optionalAuth, (req, res) => {
  try {
    const { date } = req.body;
    const post = queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    const publishDate = date || new Date().toISOString().split('T')[0];
    const stages = ['pesquisar','planejar','criar','editar','validar','aprovar','publicar','medir'];
    const nextStage = stages[stages.indexOf('publicar') + 1];
    const analyst = queryOne('SELECT name FROM team_members WHERE stage = ?', ['medir']);
    const now = Math.floor(Date.now() / 1000);
    runSql('UPDATE posts SET stage=?, assigned_to=?, scheduled_date=?, published_date=?, updated_at=? WHERE id=?',
      [nextStage, analyst?.name||'', publishDate, publishDate, now, req.params.id]);
    logAutomation('publish', req.params.id, `Publicado em ${publishDate}`);
    const updated = queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    res.json(parsePost(updated));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao publicar' });
  }
});

router.post('/:id/metrics', optionalAuth, (req, res) => {
  try {
    const { likes, comments, shares, reach, saves } = req.body;
    const post = queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    const current = JSON.parse(post.metrics||'{}');
    const updated = { ...current, likes: likes??current.likes, comments: comments??current.comments, shares: shares??current.shares, reach: reach??current.reach, saves: saves??current.saves };
    const now = Math.floor(Date.now() / 1000);
    runSql('UPDATE posts SET metrics=?, updated_at=? WHERE id=?', [JSON.stringify(updated), now, req.params.id]);
    const result = queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    res.json(parsePost(result));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar métricas' });
  }
});

router.get('/counts/by-stage', (req, res) => {
  try {
    const rows = queryObjects('SELECT stage, COUNT(*) as count FROM posts GROUP BY stage');
    const stages = ['pesquisar','planejar','criar','editar','validar','aprovar','publicar','medir'];
    const result = {};
    stages.forEach(s => { result[s] = 0; });
    rows.forEach(r => { if (result[r.stage] !== undefined) result[r.stage] = r.count; });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar contagens' });
  }
});

router.get('/activity/recent', (req, res) => {
  try {
    const logs = queryObjects('SELECT * FROM automation_log ORDER BY created_at DESC LIMIT 20');
    res.json(logs.map(l => ({
      id: l.id, action: l.action, postId: l.post_id, details: l.details,
      status: l.status, time: new Date((l.created_at||0)*1000).toLocaleDateString('pt-BR')
    })));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar atividades' });
  }
});

function parsePost(row) {
  if (!row) return null;
  return { ...row, hashtags: JSON.parse(row.hashtags||'[]'), metrics: JSON.parse(row.metrics||'null'), feedback: JSON.parse(row.feedback||'[]') };
}

function logAutomation(action, postId, details) {
  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  runSql('INSERT INTO automation_log (id, action, post_id, details, created_at) VALUES (?, ?, ?, ?, ?)', [id, action, postId, details, now]);
}

module.exports = router;
