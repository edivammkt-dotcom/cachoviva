const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { queryOne, runSql } = require('../database');
const config = require('../config');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
    const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'Email já cadastrado' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();
    runSql('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)', [id, name, email, hashedPassword]);
    const token = jwt.sign({ id, name, email, role: 'admin' }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    res.status(201).json({ id, name, email, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: 'Email ou senha inválidos' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Email ou senha inválidos' });
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    res.json({ id: user.id, name: user.name, email: user.email, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/me', authenticate, (req, res) => res.json(req.user));

module.exports = router;
