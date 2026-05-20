const ContentAI = require('./ai');
const { runSql, queryOne, queryObjects } = require('../database');
const { v4: uuidv4 } = require('uuid');

const ai = new ContentAI();

const STAGE_ORDER = ['pesquisar', 'planejar', 'criar', 'editar', 'validar', 'aprovar', 'publicar', 'medir'];
const STAGE_ASSIGNEES = {
  pesquisar: 'Ana Pesquisa',
  planejar: 'Bruno Planeja',
  criar: 'Carla Cria',
  editar: 'Diego Edita',
  validar: 'Eva Valida',
  aprovar: 'Fabio Aprova',
  publicar: 'Gabi Publica',
  medir: 'Hugo Mede'
};

let notifyCallback = null;

function setNotifyCallback(cb) {
  notifyCallback = cb;
}

function advanceTo(post, newStage) {
  const now = Math.floor(Date.now() / 1000);
  runSql(
    'UPDATE posts SET stage = ?, assigned_to = ?, updated_at = ? WHERE id = ?',
    [newStage, STAGE_ASSIGNEES[newStage] || '', now, post.id]
  );
  logAction('auto_advance', post.id, `Avancou para ${newStage}`);
}

function logAction(action, postId, details) {
  runSql(
    'INSERT INTO automation_log (id, action, post_id, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), action, postId || '', details, 'success', Math.floor(Date.now() / 1000)]
  );
}

async function autoAdvancePost(post, chatId) {
  console.log(`[StageManager] Processando post ${post.id} no estagio ${post.stage}`);

  switch (post.stage) {
    case 'criar': {
      const parsed = parseContent(post.content);

      const format = parsed.format || 'post';
      const fullContent = await ai.generateFullContent(
        post.title,
        post.description,
        post.platform,
        format
      );

      const updatedContent = { ...parsed, fullContent };
      runSql('UPDATE posts SET content = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(updatedContent), Math.floor(Date.now() / 1000), post.id]);

      logAction('ai_generate', post.id, `Conteudo gerado via IA para ${post.platform}`);
      advanceTo(post, 'editar');
      return {
        action: 'advanced',
        newStage: 'editar',
        message: `Texto gerado para "${post.title}" (${post.platform}). Revisando...`
      };
    }

    case 'editar': {
      const review = await ai.reviewContent(post);

      const parsed = parseContent(post.content);
      parsed.review = review;
      parsed.reviewedText = review.revisedContent || (parsed.fullContent ? parsed.fullContent.mainText : '');

      runSql('UPDATE posts SET content = ?, updated_at = ? WHERE id = ?',
        [JSON.stringify(parsed), Math.floor(Date.now() / 1000), post.id]);

      logAction('ai_review', post.id, `Revisao concluida. Score: ${review.score}`);
      advanceTo(post, 'validar');
      return {
        action: 'advanced',
        newStage: 'validar',
        message: `Revisao: ${post.title} (${post.platform}) - Score ${review.score}/10. Validando...`
      };
    }

    case 'validar': {
      const validation = await ai.validateContent(post);

      logAction('ai_validate', post.id, `Validacao concluida. Passed: ${validation.passed}, Score: ${validation.score}`);

      if (validation.passed && validation.score >= 6) {
        advanceTo(post, 'aprovar');
        return {
          action: 'advanced',
          newStage: 'aprovar',
          message: buildContentPreview(post),
          needsApproval: true
        };
      } else {
        advanceTo(post, 'editar');
        return {
          action: 'sendback',
          newStage: 'editar',
          message: `Conteudo "${post.title}" nao passou na validacao (score: ${validation.score}/10). Voltando para edicao.`
        };
      }
    }

    case 'aprovar': {
      return {
        action: 'awaiting_approval',
        newStage: 'aprovar',
        message: buildContentPreview(post),
        needsApproval: true
      };
    }

    default:
      return { action: 'none', message: '' };
  }
}

function parseContent(content) {
  if (!content) return {};
  try { return typeof content === 'string' ? JSON.parse(content) : content; }
  catch { return {}; }
}

function buildContentPreview(post) {
  const parsed = parseContent(post.content);
  const mainText = parsed.reviewedText || (parsed.fullContent ? parsed.fullContent.mainText : '') || post.description;

  let msg = `Conteudo pronto!\n\n`;
  msg += `Titulo: ${post.title}\n`;
  msg += `Plataforma: ${post.platform}\n`;
  msg += `Formato: ${parsed.format || 'post'}\n\n`;

  msg += `Preview:\n`;
  msg += `${mainText.substring(0, 400)}${mainText.length > 400 ? '...' : ''}\n\n`;

  if (parsed.fullContent && parsed.fullContent.hashtags) {
    const tags = Array.isArray(parsed.fullContent.hashtags) ? parsed.fullContent.hashtags : [];
    if (tags.length > 0) {
      msg += `Tags: ${tags.slice(0, 5).join(' ')}\n\n`;
    }
  }

  if (parsed.review) {
    msg += `Score: ${parsed.review.score}/10\n`;
    if (parsed.review.suggestions && parsed.review.suggestions.length > 0) {
      msg += `Sugestoes: ${parsed.review.suggestions.slice(0, 2).join('; ')}\n`;
    }
    msg += `\n`;
  }

  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + 1);
  const dateStr = scheduledDate.toISOString().split('T')[0];

  msg += `Comandos:\n`;
  msg += `/publish_${post.id} - Publicar\n`;
  msg += `/schedule_${post.id} ${dateStr} - Agendar\n`;
  msg += `/editfinal_${post.id} + texto - Ajustar\n`;

  return msg;
}

async function processStage(postId, chatId) {
  const post = queryOne('SELECT * FROM posts WHERE id = ?', [postId]);
  if (!post) return { action: 'notfound', message: 'Post nao encontrado' };

  if (post.stage === 'aprovar') {
    return await autoAdvancePost(post, chatId);
  }
  if (post.stage === 'publicar' || post.stage === 'medir') {
    return { action: 'none', message: '' };
  }

  return await autoAdvancePost(post, chatId);
}

async function startPipeline(postId, chatId) {
  let result = { action: 'started', message: '' };

  while (true) {
    const post = queryOne('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!post) break;

    if (post.stage === 'aprovar') {
      result = await autoAdvancePost(post, chatId);
      result.needsApproval = true;
      if (notifyCallback && chatId && result.message) {
        notifyCallback(chatId, result.message);
      }
      break;
    }

    if (post.stage === 'publicar' || post.stage === 'medir') {
      result = { action: 'completed', message: `✅ Publicado: ${post.title}` };
      if (notifyCallback && chatId && result.message) {
        notifyCallback(chatId, result.message);
      }
      break;
    }

    const r = await autoAdvancePost(post, chatId);
    result = r;

    if (r.message && chatId && r.action !== 'none') {
      if (notifyCallback) {
        notifyCallback(chatId, `[${post.platform}] ${r.message}`);
      }
    }

    if (r.needsApproval) break;

    const updated = queryOne('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!updated || updated.stage === post.stage) break;
  }

  return result;
}

module.exports = { processStage, startPipeline, buildContentPreview, setNotifyCallback };
