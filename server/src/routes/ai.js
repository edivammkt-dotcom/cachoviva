const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { runSql, queryOne, queryObjects } = require('../database');
const ContentAI = require('../services/ai');
const MediaGenerator = require('../services/mediaGenerator');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();
const mediaGenerator = new MediaGenerator();
const contentAI = new ContentAI();

router.post('/generate-ideas', optionalAuth, async (req, res) => {
  try {
    const { topic, platform, audience } = req.body;
    if (!topic || !platform) {
      return res.status(400).json({ error: 'Topico e plataforma sao obrigatorios' });
    }
    const ideas = await contentAI.generateContentIdeas(topic, platform, audience);
    const ideaId = uuidv4();
    runSql(
      'INSERT INTO generated_content (id, user_id, type, platform, data, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [ideaId, req.user?.id || null, 'ideas', platform, JSON.stringify(ideas), Math.floor(Date.now()/1000)]
    );
    res.json({ success: true, ideas, ideaId });
  } catch (error) {
    console.error('Generate ideas error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate-content', optionalAuth, async (req, res) => {
  try {
    const { topic, platform, options = {} } = req.body;
    if (!topic || !platform) {
      return res.status(400).json({ error: 'Topico e plataforma sao obrigatorios' });
    }
    const result = await mediaGenerator.generateCompleteContent(topic, platform, options);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    const contentId = uuidv4();
    runSql(
      'INSERT INTO generated_content (id, user_id, type, platform, data, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [contentId, req.user?.id || null, 'complete', platform, JSON.stringify(result.content), Math.floor(Date.now()/1000)]
    );
    res.json({ success: true, content: result.content, contentId, packagePath: result.packagePath });
  } catch (error) {
    console.error('Generate content error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate-carousel', optionalAuth, async (req, res) => {
  try {
    const { topic, options = {} } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'Topico e obrigatorio' });
    }
    const result = await mediaGenerator.generateInstagramCarousel(topic, options);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    const carouselId = uuidv4();
    runSql(
      'INSERT INTO generated_content (id, user_id, type, platform, data, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [carouselId, req.user?.id || null, 'carousel', 'instagram', JSON.stringify(result.carousel), Math.floor(Date.now()/1000)]
    );
    res.json({ success: true, carousel: result.carousel, mediaFiles: result.mediaFiles, carouselId });
  } catch (error) {
    console.error('Generate carousel error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate-video', optionalAuth, async (req, res) => {
  try {
    const { topic, options = {} } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'Topico e obrigatorio' });
    }
    const result = await mediaGenerator.generateShortVideo(topic, options);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    const videoId = uuidv4();
    runSql(
      'INSERT INTO generated_content (id, user_id, type, platform, data, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [videoId, req.user?.id || null, 'video', options.platform || 'tiktok', JSON.stringify(result.video), Math.floor(Date.now()/1000)]
    );
    res.json({ success: true, video: result.video, scenes: result.scenes, videoId });
  } catch (error) {
    console.error('Generate video error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate-preview', optionalAuth, async (req, res) => {
  try {
    const { topic, platform, tone = 'cachoviva', options = {} } = req.body;
    if (!topic || !platform) {
      return res.status(400).json({ error: 'Topico e plataforma sao obrigatorios' });
    }
    const result = await contentAI.generatePostPreview(topic, platform, tone, options);
    if (!result.success) {
      return res.status(500).json({ error: 'Falha ao gerar preview' });
    }
    let imageData = null;
    try {
      const imgPrompt = result.preview.imagePrompt || `${topic} - CachoViva brand content`;
      const imgStyle = result.preview.imageStyle || 'cachoviva';
      imageData = await contentAI.generateImage(imgPrompt, imgStyle);
    } catch (err) {
      console.warn('[Preview] Erro ao gerar imagem:', err.message);
    }
    const previewId = uuidv4();
    runSql(
      'INSERT INTO generated_content (id, user_id, type, platform, data, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [previewId, req.user?.id || null, 'preview', platform, JSON.stringify({ preview: result.preview, image: imageData }), Math.floor(Date.now()/1000)]
    );
    res.json({ success: true, preview: result.preview, image: imageData, previewId });
  } catch (error) {
    console.error('Generate preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate-text', optionalAuth, async (req, res) => {
  try {
    const { title, description, platform, tone = 'cachoviva' } = req.body;
    if (!title || !platform) {
      return res.status(400).json({ error: 'Titulo e plataforma sao obrigatorios' });
    }
    const text = await contentAI.generatePostContent(title, description, platform, tone);
    const textId = uuidv4();
    runSql(
      'INSERT INTO generated_content (id, user_id, type, platform, data, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [textId, req.user?.id || null, 'text', platform, JSON.stringify({ text, title, description }), Math.floor(Date.now()/1000)]
    );
    res.json({ success: true, text, textId });
  } catch (error) {
    console.error('Generate text error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate-image', optionalAuth, async (req, res) => {
  try {
    const { prompt, style = 'professional' } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt e obrigatorio' });
    }
    const image = await contentAI.generateImage(prompt, style);
    const imageId = uuidv4();
    runSql(
      'INSERT INTO generated_content (id, user_id, type, platform, data, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [imageId, req.user?.id || null, 'image', 'general', JSON.stringify(image), Math.floor(Date.now()/1000)]
    );
    res.json({ success: true, image, imageId });
  } catch (error) {
    console.error('Generate image error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/generate-insights', optionalAuth, async (req, res) => {
  try {
    const { posts } = req.body;
    if (!posts || !Array.isArray(posts)) {
      return res.status(400).json({ error: 'Posts invalidos' });
    }
    const insights = await contentAI.generatePerformanceInsights(posts);
    const insightsId = uuidv4();
    runSql(
      'INSERT INTO generated_content (id, user_id, type, platform, data, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [insightsId, req.user?.id || null, 'insights', 'analytics', JSON.stringify(insights), Math.floor(Date.now()/1000)]
    );
    res.json({ success: true, insights, insightsId });
  } catch (error) {
    console.error('Generate insights error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/generated-content', optionalAuth, async (req, res) => {
  try {
    const { type, platform, limit = 50 } = req.query;
    let sql = 'SELECT id, type, platform, data, created_at FROM generated_content WHERE user_id = ?';
    const params = [req.user?.id || null];
    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (platform) { sql += ' AND platform = ?'; params.push(platform); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    const content = queryObjects(sql, params);
    res.json({ success: true, content });
  } catch (error) {
    console.error('List generated content error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/create-post-from-generated', optionalAuth, async (req, res) => {
  try {
    const { contentId, title, platform, stage = 'criar' } = req.body;
    if (!contentId || !platform) {
      return res.status(400).json({ error: 'Content ID e plataforma sao obrigatorios' });
    }
    const generated = queryOne('SELECT data FROM generated_content WHERE id = ? AND user_id = ?', [contentId, req.user?.id || null]);
    if (!generated) {
      return res.status(404).json({ error: 'Conteudo gerado nao encontrado' });
    }
    const contentData = JSON.parse(generated.data);
    const postId = uuidv4();
    const postData = {
      id: postId,
      title: title || contentData.title || 'Post gerado',
      description: contentData.components?.text || contentData.text || '',
      platform,
      stage,
      content: JSON.stringify(contentData),
      generated_from: contentId,
      user_id: req.user?.id || null,
      created_at: Math.floor(Date.now()/1000),
      updated_at: Math.floor(Date.now()/1000)
    };
    runSql(
      'INSERT INTO posts (id, title, description, platform, stage, content, generated_from, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [postData.id, postData.title, postData.description, postData.platform, postData.stage,
       postData.content, postData.generated_from, postData.user_id, postData.created_at, postData.updated_at]
    );
    res.json({ success: true, post: postData, postId });
  } catch (error) {
    console.error('Create post from generated error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/test', async (req, res) => {
  try {
    const { initialize: initOrch } = require('../services/orchestrator');
    await initOrch();
    const ContentAI = require('../services/ai');
    const ai = new ContentAI();
    const result = await ai.generateCompleteSuggestion('como creme de pentear age no cabelo');
    res.json({ success: true, gemini_responded: !result.briefing?.includes('Criar conteudo sobre'), result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
});

router.get('/test-simple', async (req, res) => {
  try {
    const ContentAI = require('../services/ai');
    const ai = new ContentAI();
    const text = await ai.generatePostContent('Creme para cachos', 'Teste de conexao Gemini', 'instagram');
    res.json({ success: true, generated: !!text, text });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/test-lite', async (req, res) => {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const config = require('../config');
    const client = new GoogleGenerativeAI(config.gemini.apiKey);

    const models = ['gemini-2.0-flash-lite', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest'];
    const results = [];

    for (const modelName of models) {
      try {
        const model = client.getGenerativeModel({ model: modelName });
        const result = await Promise.race([
          model.generateContent('Responda apenas "OK"'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000))
        ]);
        const text = result.response?.text();
        results.push({ model: modelName, ok: true, response: text });
        break;
      } catch (err) {
        const msg = err.message || '';
        results.push({ model: modelName, ok: false, error: msg.substring(0, 100) });
      }
    }

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/test-image', async (req, res) => {
  try {
    const prompt = req.query.prompt || 'curly hair social media post';
    const result = await contentAI.generateImage(prompt);
    res.json({
      success: !!result?.imageUrl,
      imageUrl: result?.imageUrl || null,
      mimeType: result?.mimeType || null,
      note: 'Pollinations.ai free provider'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/diagnose', async (req, res) => {
  const config = require('../config');
  const diagnostics = {
    apiKeyPresent: !!config.gemini.apiKey,
    apiKeyLength: (config.gemini.apiKey || '').length,
    apiKeyPrefix: (config.gemini.apiKey || '').substring(0, 10),
    model: config.gemini.textModel,
    isAIReady: false,
    canInit: false,
    generateError: null,
    generateResult: null
  };

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    diagnostics.isAIReady = true;

    const model = genAI.getGenerativeModel({ model: config.gemini.textModel });
    diagnostics.canInit = true;

    const result = await Promise.race([
      model.generateContent('Responda apenas: "OK"'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000))
    ]);

    diagnostics.generateResult = result.response.text();
  } catch (err) {
    diagnostics.generateError = { name: err.name, message: err.message, stack: (err.stack || '').substring(0, 300) };
  }

  res.json(diagnostics);
});

module.exports = router;
