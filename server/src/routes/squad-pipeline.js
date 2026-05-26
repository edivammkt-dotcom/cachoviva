const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { runSql, queryOne, queryObjects } = require('../database');
const { executeSquad, getBrandContext } = require('../services/squadManager');
const { sendToTelegram, sendTelegramMessage, sendTelegramPhoto } = require('../services/telegram');
const { applyLogoToImages } = require('../services/logoBranding');
const router = express.Router();

const PIPELINE_CONFIG = {
  autoInterval: '0 0 */2 * *',
  maxPostsPerCycle: 3,
  minScore: 70
};

function log(action, postId, details) {
  runSql(
    'INSERT INTO automation_log (id, action, post_id, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), action, postId || '', details || '', 'success', Math.floor(Date.now() / 1000)]
  );
}

function getActiveBriefing() {
  return queryOne('SELECT * FROM briefings WHERE active = 1 ORDER BY created_at DESC LIMIT 1');
}

function getActiveKeywords() {
  return queryObjects('SELECT keyword FROM research_keywords WHERE active = 1');
}

router.post('/run', async (req, res) => {
  try {
    const { briefing } = req.body;
    const result = await runFullPipeline(briefing);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[SquadPipeline] Erro:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/status', (req, res) => {
  const activeBriefing = getActiveBriefing();
  const keywords = getActiveKeywords();
  const pendingPosts = queryObjects(
    "SELECT * FROM posts WHERE stage = 'pending_approval' ORDER BY created_at DESC LIMIT 10"
  );
  const recentLogs = queryObjects(
    'SELECT * FROM automation_log ORDER BY created_at DESC LIMIT 20'
  );
  const config = queryOne("SELECT * FROM squad_config ORDER BY updated_at DESC LIMIT 1");

  res.json({
    briefing: activeBriefing,
    keywords,
    pendingApproval: pendingPosts,
    logs: recentLogs,
    config: config || { autoInterval: PIPELINE_CONFIG.autoInterval, maxPostsPerCycle: PIPELINE_CONFIG.maxPostsPerCycle }
  });
});

router.post('/config', (req, res) => {
  const { autoInterval, maxPostsPerCycle } = req.body;
  const id = uuidv4();
  runSql(
    'INSERT INTO squad_config (id, auto_interval, max_posts_per_cycle, updated_at) VALUES (?, ?, ?, ?)',
    [id, autoInterval || PIPELINE_CONFIG.autoInterval, maxPostsPerCycle || PIPELINE_CONFIG.maxPostsPerCycle, Math.floor(Date.now() / 1000)]
  );
  res.json({ success: true, id });
});

router.get('/history', (req, res) => {
  const page = parseInt(req.query.page || '0');
  const limit = parseInt(req.query.limit || '20');
  const offset = page * limit;
  const search = req.query.search || '';
  const stage = req.query.stage || '';
  let where = '1=1';
  const params = [];
  if (search) { where += ' AND title LIKE ?'; params.push('%' + search + '%'); }
  if (stage) { where += ' AND stage = ?'; params.push(stage); }
  const posts = queryObjects(
    `SELECT id, title, platform, stage, created_at, updated_at FROM posts WHERE ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const totalRow = queryOne(`SELECT COUNT(*) as total FROM posts WHERE ${where}`, params);
  res.json({ posts, total: totalRow?.total || 0, page, limit });
});

router.get('/post/:id', (req, res) => {
  const post = queryOne('SELECT * FROM posts WHERE id = ?', [req.params.id]);
  if (!post) return res.status(404).json({ error: 'Post não encontrado' });
  const content = (() => { try { return JSON.parse(post.content || '{}'); } catch { return {}; } })();
  res.json({ post, content });
});

router.post('/approve/:id', async (req, res) => {
  const postId = req.params.id;
  const post = queryOne('SELECT * FROM posts WHERE id = ?', [postId]);
  if (!post) return res.status(404).json({ error: 'Post não encontrado' });

  const now = Math.floor(Date.now() / 1000);
  runSql('UPDATE posts SET stage = ?, updated_at = ? WHERE id = ?', ['approved', now, postId]);
  log('approve', postId, 'Aprovado pelo usuário');
  res.json({ success: true, message: 'Post aprovado' });
});

router.post('/reject/:id', async (req, res) => {
  const postId = req.params.id;
  const post = queryOne('SELECT * FROM posts WHERE id = ?', [postId]);
  if (!post) return res.status(404).json({ error: 'Post não encontrado' });

  const now = Math.floor(Date.now() / 1000);
  runSql('UPDATE posts SET stage = ?, updated_at = ? WHERE id = ?', ['rejected', now, postId]);
  log('reject', postId, 'Rejeitado pelo usuário');
  res.json({ success: true, message: 'Post rejeitado' });
});

async function runFullPipeline(briefingInput) {
  console.log('[SquadPipeline] Iniciando pipeline completo...');
  const startTime = Date.now();

  const marca = getBrandContext();

  let pesquisaInput = briefingInput;
  if (!pesquisaInput) {
    const activeBriefing = getActiveBriefing();
    const keywords = getActiveKeywords();
    const briefText = activeBriefing?.content || '';
    const keywordText = keywords.map(k => k.keyword).join(', ');
    pesquisaInput = [
      briefText ? `Briefing ativo: ${briefText}` : '',
      keywordText ? `Keywords ativas: ${keywordText}` : '',
      'Pesquise tendências atuais para cabelos cacheados no Brasil.'
    ].filter(Boolean).join('\n');
  }

  if (!pesquisaInput) {
    pesquisaInput = 'Pesquise tendências atuais para cabelos cacheados no Brasil, público feminino 22-42 anos, classes C/D, regiões SE/BA.';
  }

  log('pipeline_start', null, `Input: ${pesquisaInput.substring(0, 100)}...`);

  const squad1 = await executeSquad(1, pesquisaInput, marca);
  log('squad1_done', null, `Ganchos: ${Array.isArray(squad1) ? squad1.length : 1}`);

  const squad2 = await executeSquad(2, squad1, marca);
  const squad2Posts = Array.isArray(squad2) ? squad2 : (squad2?.posts || []);
  log('squad2_done', null, `Posts planejados: ${squad2Posts.length}`);

  const postsToCreate = squad2Posts.slice(0, PIPELINE_CONFIG.maxPostsPerCycle);

  if (postsToCreate.length === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log('pipeline_empty', null, 'Nenhum post gerado pelo Squad2');
    return { posts: [], message: 'Nenhum post gerado', elapsed };
  }

  const createdPosts = [];

  for (const postPlan of postsToCreate) {
    try {
      const squad3Input = {
        ...postPlan,
        contexto_marca: marca
      };

      const squad3 = await executeSquad(3, squad3Input, marca);
      log('squad3_done', postPlan.id || 'unknown', `Copy gerado para ${postPlan.plataforma}`);

      const media = await generateContentMedia(squad3, postPlan);
      log('media_done', postPlan.id, `Mídia gerada: ${media?.images?.length || 0} imagens`);

      const squad4Input = {
        ...squad3,
        media,
        plataforma: postPlan.plataforma
      };
      const squad4 = await executeSquad(4, squad4Input, marca);
      log('squad4_done', postPlan.id, `Score: ${squad4?.score || 0}`);

      const score = squad4?.score || 0;
      const postStage = score >= PIPELINE_CONFIG.minScore ? 'pending_approval' : 'draft';

      const postId = uuidv4();
      const now = Math.floor(Date.now() / 1000);
      const postData = {
        id: postId,
        title: postPlan.gancho_base || squad3?.copy?.substring(0, 60) || 'Post automático',
        description: squad3?.copy || '',
        platform: postPlan.plataforma || 'instagram',
        stage: postStage,
        content: JSON.stringify({
          copy: squad3?.copy,
          hashtags: squad3?.hashtags,
          imagePrompt: squad3?.prompt_imagem,
          videoScript: squad3?.roteiro_video,
          media,
          format: postPlan.tipo || 'feed',
          squad1,
          squad2: postPlan,
          squad3,
          squad4
        }),
        hashtags: JSON.stringify(squad3?.hashtags || []),
        assigned_to: null,
        user_id: null,
        created_at: now,
        updated_at: now
      };

      runSql(
        'INSERT INTO posts (id, title, description, platform, stage, content, hashtags, assigned_to, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [postData.id, postData.title, postData.description, postData.platform, postData.stage,
         postData.content, postData.hashtags, postData.assigned_to,
         postData.user_id, postData.created_at, postData.updated_at]
      );

      createdPosts.push(postData);
      log('post_created', postId, `${postPlan.plataforma} | ${postPlan.tipo || 'feed'} | Score: ${score}`);
    } catch (err) {
      console.error(`[SquadPipeline] Erro ao criar post ${postPlan.id}:`, err.message);
      log('post_error', postPlan.id || 'unknown', err.message.substring(0, 200));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log('pipeline_complete', null, `${createdPosts.length} posts em ${elapsed}s`);

  try {
    const chatId = queryOne("SELECT chat_id FROM telegram_config WHERE enabled = 1 ORDER BY created_at DESC LIMIT 1")?.chat_id;
    if (chatId) {
      const pendingCount = createdPosts.filter(p => p.stage === 'pending_approval').length;
      const msg = [
        '━━━━━━━━━━━━━━━',
        '🤖 *Pipeline CachoViva Concluído*',
        '━━━━━━━━━━━━━━━',
        `📦 ${createdPosts.length} peças geradas`,
        `⏳ ${pendingCount} aguardando aprovação`,
        `⏱️ ${elapsed}s de processamento`,
        '',
        pendingCount > 0
          ? '👉 Acesse o dashboard para revisar: cachoviva.onrender.com/squad.html'
          : '⚠️ Nenhuma peça atingiu o score mínimo para aprovação.',
        '━━━━━━━━━━━━━━━'
      ].join('\n');
      await sendToTelegram(msg);
    }
  } catch (err) {
    console.warn('[SquadPipeline] Erro ao notificar Telegram:', err.message);
  }

  return { posts: createdPosts, elapsed };
}

async function generateContentMedia(squad3, postPlan) {
  const media = { images: [], videoScript: null, carousel: null };
  const replicateImage = require('../services/replicateImage');
  const ai = new (require('../services/ai'))();

  const format = postPlan.tipo || 'feed';

  if (format === 'carrossel' && squad3?.prompt_imagem) {
    const slidesPrompt = `${squad3.prompt_imagem}. Crie 5 slides para carrossel do Instagram, mantendo identidade visual consistente.`;
    try {
      const carousel = await ai.generateCarousel(postPlan.gancho_base || squad3.copy, 5);
      if (carousel?.slides) {
        media.carousel = { slides: [] };
        for (let i = 0; i < carousel.slides.length; i++) {
          const slide = carousel.slides[i];
          try {
            const imgArr = await replicateImage.generateImage(slide.visual || slide.title, 'cachoviva');
            const brandedUrl = imgArr[0]?.url;
            if (brandedUrl) {
              media.images.push({ url: brandedUrl, slide: i + 1, text: slide.text });
              media.carousel.slides.push({ ...slide, imageUrl: brandedUrl });
            }
          } catch (e) {
            console.warn(`[SquadPipeline] Erro imagem slide ${i}:`, e.message);
          }
        }
      }
    } catch (err) {
      console.warn('[SquadPipeline] Erro carrossel:', err.message);
    }
  } else if (squad3?.prompt_imagem) {
    const imgArr = await replicateImage.generateImage(squad3.prompt_imagem, 'cachoviva');
    imgArr.forEach((img, i) => {
      media.images.push({ url: img.url, variant: i });
    });
  }

  if (squad3?.roteiro_video) {
    media.videoScript = squad3.roteiro_video;
  }

  return media;
}

async function autoCycle() {
  console.log('[SquadPipeline] Ciclo automático iniciado...');
  try {
    const result = await runFullPipeline();
    const pendingCount = result.posts?.filter(p => p.stage === 'pending_approval').length || 0;
    if (pendingCount > 0) {
      const chatId = queryOne("SELECT chat_id FROM telegram_config WHERE enabled = 1 ORDER BY created_at DESC LIMIT 1")?.chat_id;
      if (chatId) {
        for (const post of result.posts.filter(p => p.stage === 'pending_approval')) {
          const content = (() => { try { return JSON.parse(post.content || '{}'); } catch { return {}; } })();
          const code = post.id.substring(0, 4);

          let msg = `📢 *Nova peça para aprovação*\n━━━━━━━━━━━━━━━\n📄 ${post.title}\n📱 ${post.platform} | 🎯 ${content.format || 'feed'}\n━━━━━━━━━━━━━━━\n\n📝 ${(content.copy || '').substring(0, 280)}${(content.copy || '').length > 280 ? '...' : ''}`;

          if (content.hashtags?.length) {
            msg += `\n\n🏷️ ${content.hashtags.join(' ')}`;
          }

          if (content.media?.videoScript) {
            msg += `\n\n🎬 *Roteiro:* ${content.media.videoScript}`;
          }

          const buttons = [
            [
              { text: '✅ Aprovar', callback_data: `/sq_ok_${code}` },
              { text: '❌ Rejeitar', callback_data: `/sq_no_${code}` }
            ]
          ];

          if (content.media?.images?.length > 0) {
            await sendTelegramMessage(chatId, msg);
            const firstImg = content.media.images[0];
            if (firstImg?.url) {
              try {
                await sendTelegramPhoto(chatId, firstImg.url, `🖼️ Preview — ${post.title}`, buttons);
              } catch {
                await sendTelegramMessage(chatId, msg, buttons);
              }
            } else {
              await sendTelegramMessage(chatId, msg, buttons);
            }
          } else {
            await sendTelegramMessage(chatId, msg, buttons);
          }
        }
      }
    }
  } catch (err) {
    console.error('[SquadPipeline] Erro no ciclo automático:', err.message);
  }
}

router.post('/publish/:id', async (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  runSql('UPDATE posts SET stage = ?, updated_at = ? WHERE id = ?', ['published', now, req.params.id]);
  log('publish', req.params.id, 'Marcado como publicado');
  res.json({ success: true, message: 'Post marcado como publicado' });
});

router.get('/approved', (req, res) => {
  const posts = queryObjects(
    "SELECT id, title, platform, stage, created_at, updated_at FROM posts WHERE stage IN ('approved', 'published') ORDER BY updated_at DESC LIMIT 50"
  );
  const full = posts.map(p => {
    const post = queryOne('SELECT * FROM posts WHERE id = ?', [p.id]);
    const content = (() => { try { return JSON.parse(post?.content || '{}'); } catch { return {}; } })();
    return { ...p, content };
  });
  res.json({ posts: full });
});

router.post('/briefing', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto do briefing obrigatório' });
  runSql('UPDATE briefings SET active = 0 WHERE active = 1');
  const id = uuidv4();
  runSql(
    'INSERT INTO briefings (id, content, platform_focus, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)',
    [id, text, 'instagram', Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
  );
  log('briefing_set', null, text.substring(0, 100));
  res.json({ success: true, id, message: 'Briefing salvo' });
});

router.post('/test-veo', async (req, res) => {
  const { generateVideo } = require('../services/videoGenerator');
  try {
    const prompt = req.body.prompt || 'Brazilian Black woman with curly hair 3B-3C, smiling, holding orange and blue hair products, tropical beach sunset, golden hour, palm trees, slow motion, cinematic';
    res.json({ status: 'iniciado', message: 'Geração em background. Acompanhe no terminal.' });
    generateVideo(prompt, { durationSeconds: 4 }).then(videos => {
      if (videos && videos.length > 0) {
        console.log(`[Veo] ✅ Sucesso! ${videos.length} vídeo(s): ${videos[0].videoUrl}`);
      } else {
        console.log('[Veo] ❌ Nenhum vídeo retornado');
      }
    }).catch(err => {
      console.error('[Veo] ❌ Erro:', err.message);
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/test-runway', async (req, res) => {
  const { generateVideo } = require('../services/videoGenerator');
  try {
    const prompt = req.body.prompt || 'Brazilian Black woman with curly hair 3B-3C, smiling, holding orange and blue hair products, tropical beach sunset, golden hour, palm trees, slow motion, cinematic';
    res.json({ status: 'iniciado', message: 'Geração em background. Acompanhe no terminal.' });
    generateVideo(prompt, { durationSeconds: 5 }).then(videos => {
      if (videos && videos.length > 0) {
        console.log(`[Runway] ✅ Sucesso! ${videos.length} vídeo(s): ${videos[0].videoUrl}`);
      } else {
        console.log('[Runway] ❌ Nenhum vídeo retornado');
      }
    }).catch(err => {
      console.error('[Runway] ❌ Erro:', err.message);
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/test-replicate', async (req, res) => {
  const axios = require('axios');
  const TOKEN = process.env.REPLICATE_API_KEY || '';
  const results = [];

  for (const model of [{ owner: 'black-forest-labs', name: 'flux-dev' }, { owner: 'black-forest-labs', name: 'flux-schnell' }]) {
    try {
      const start = Date.now();
      const { data } = await axios.post(
        `https://api.replicate.com/v1/models/${model.owner}/${model.name}/predictions`,
        { input: { prompt: 'test, woman with curly hair, warm tones', num_outputs: 1, aspect_ratio: '1:1', output_format: 'jpg' } },
        { headers: { Authorization: `Token ${TOKEN}`, 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      results.push({ model: `${model.owner}/${model.name}`, predictionId: data.id, status: data.status, timeMs: Date.now() - start });
    } catch (err) {
      results.push({
        model: `${model.owner}/${model.name}`,
        error: err.message,
        detail: err.response?.data?.detail || err.response?.data || null,
        statusCode: err.response?.status || null,
        statusText: err.response?.statusText || null,
      });
    }
  }

  res.json({ results });
});

module.exports = { router, runFullPipeline, autoCycle };
