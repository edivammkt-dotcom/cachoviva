const express = require('express');
const { queryOne, queryObjects, runSql } = require('../database');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const members = queryObjects('SELECT * FROM team_members WHERE active = 1 ORDER BY stage');
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar equipe' });
  }
});

router.put('/:role', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    const existing = queryOne('SELECT * FROM team_members WHERE role = ?', [req.params.role]);
    if (!existing) return res.status(404).json({ error: 'Membro não encontrado' });
    runSql('UPDATE team_members SET name = ? WHERE role = ?', [name, req.params.role]);
    const member = queryOne('SELECT * FROM team_members WHERE role = ?', [req.params.role]);
    res.json(member);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar membro' });
  }
});

module.exports = router;
