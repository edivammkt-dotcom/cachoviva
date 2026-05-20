const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryObjects, runSql } = require('../database');
const { authenticate } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

router.get('/accounts', authenticate, (req, res) => {
  try {
    const accounts = queryObjects('SELECT id, platform, account_name, account_id, connected_at FROM social_accounts WHERE user_id = ?', [req.user.id]);
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar contas' });
  }
});

router.delete('/accounts/:id', authenticate, (req, res) => {
  try {
    runSql('DELETE FROM social_accounts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Conta desconectada' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao desconectar conta' });
  }
});

router.get('/:platform/auth-url', authenticate, (req, res) => {
  const { platform } = req.params;
  const valid = ['instagram', 'tiktok', 'youtube'];
  if (!valid.includes(platform)) return res.status(400).json({ error: 'Plataforma inválida' });
  const state = Buffer.from(JSON.stringify({ userId: req.user.id, platform })).toString('base64');
  let url = '';
  switch (platform) {
    case 'instagram':
      url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${config.social.instagram.appId}&redirect_uri=${encodeURIComponent(config.social.instagram.redirectUri)}&state=${state}&scope=instagram_basic,instagram_content_publish,instagram_manage_comments,pages_read_engagement`;
      break;
    case 'tiktok':
      url = `https://www.tiktok.com/v2/auth/authorize?client_key=${config.social.tiktok.clientKey}&redirect_uri=${encodeURIComponent(config.social.tiktok.redirectUri)}&state=${state}&scope=user.info.basic,video.publish,video.upload`;
      break;
    case 'youtube':
      url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.social.youtube.clientId}&redirect_uri=${encodeURIComponent(config.social.youtube.redirectUri)}&state=${state}&scope=https://www.googleapis.com/auth/youtube.upload+https://www.googleapis.com/auth/youtube.readonly&response_type=code&access_type=offline`;
      break;
  }
  res.json({ url, platform });
});

router.get('/:platform/callback', async (req, res) => {
  const { platform } = req.params;
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${req.headers.origin||'http://localhost:3000'}?social_error=${error}`);
  if (!code||!state) return res.status(400).json({ error: 'Código ou state não fornecido' });
  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const userId = stateData.userId;
    let tokenData;
    switch (platform) {
      case 'instagram': tokenData = await exchangeInstagramCode(code); break;
      case 'tiktok': tokenData = await exchangeTikTokCode(code); break;
      case 'youtube': tokenData = await exchangeYouTubeCode(code); break;
      default: return res.status(400).json({ error: 'Plataforma inválida' });
    }
    if (!tokenData) return res.redirect(`${req.headers.origin||'http://localhost:3000'}?social_error=token_exchange_failed`);
    const id = uuidv4();
    runSql('INSERT INTO social_accounts (id, platform, account_name, account_id, access_token, refresh_token, token_expires_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, platform, tokenData.accountName, tokenData.accountId, tokenData.accessToken, tokenData.refreshToken||'', tokenData.expiresAt||0, userId]);
    res.redirect(`${req.headers.origin||'http://localhost:3000'}?social=connected&platform=${platform}`);
  } catch (err) {
    console.error('Callback error:', err);
    res.redirect(`${req.headers.origin||'http://localhost:3000'}?social_error=callback_error`);
  }
});

async function exchangeInstagramCode(code) {
  const axios = require('axios');
  try {
    const resp = await axios.post('https://graph.facebook.com/v18.0/oauth/access_token', null, {
      params: { client_id: config.social.instagram.appId, client_secret: config.social.instagram.appSecret, redirect_uri: config.social.instagram.redirectUri, code }
    });
    const shortToken = resp.data.access_token;
    const longResp = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: { grant_type: 'fb_exchange_token', client_id: config.social.instagram.appId, client_secret: config.social.instagram.appSecret, fb_exchange_token: shortToken }
    });
    const longToken = longResp.data.access_token;
    const accountsResp = await axios.get('https://graph.facebook.com/v18.0/me/accounts', { params: { access_token: longToken } });
    const page = accountsResp.data.data?.[0];
    if (!page) throw new Error('Nenhuma página encontrada');
    const igResp = await axios.get(`https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${longToken}`);
    const igId = igResp.data.instagram_business_account?.id;
    return { accessToken: longToken, refreshToken: '', expiresAt: Math.floor(Date.now()/1000)+5184000, accountName: page.name, accountId: igId||page.id };
  } catch (err) { console.error('Instagram exchange error:', err); return null; }
}

async function exchangeTikTokCode(code) {
  const axios = require('axios');
  try {
    const resp = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', {
      client_key: config.social.tiktok.clientKey, client_secret: config.social.tiktok.clientSecret, code, grant_type: 'authorization_code', redirect_uri: config.social.tiktok.redirectUri
    }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const accessToken = resp.data.access_token;
    const userResp = await axios.get('https://open.tiktokapis.com/v2/user/info/', { params: { fields: 'display_name,username' }, headers: { Authorization: `Bearer ${accessToken}` } });
    const user = userResp.data.data?.user;
    return { accessToken, refreshToken: resp.data.refresh_token||'', expiresAt: Math.floor(Date.now()/1000)+(resp.data.expires_in||86400), accountName: user?.display_name||'TikTok User', accountId: user?.username||'unknown' };
  } catch (err) { console.error('TikTok exchange error:', err); return null; }
}

async function exchangeYouTubeCode(code) {
  const axios = require('axios');
  try {
    const resp = await axios.post('https://oauth2.googleapis.com/token', {
      code, client_id: config.social.youtube.clientId, client_secret: config.social.youtube.clientSecret, redirect_uri: config.social.youtube.redirectUri, grant_type: 'authorization_code'
    });
    const accessToken = resp.data.access_token;
    const channelResp = await axios.get('https://www.googleapis.com/youtube/v3/channels', { params: { part: 'snippet', mine: true }, headers: { Authorization: `Bearer ${accessToken}` } });
    const channel = channelResp.data.items?.[0];
    return { accessToken, refreshToken: resp.data.refresh_token||'', expiresAt: Math.floor(Date.now()/1000)+(resp.data.expires_in||3600), accountName: channel?.snippet?.title||'YouTube Channel', accountId: channel?.id||'unknown' };
  } catch (err) { console.error('YouTube exchange error:', err); return null; }
}

module.exports = router;
