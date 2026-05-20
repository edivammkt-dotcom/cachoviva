const ContentAI = require('./ai');
const { generateText, parseJSON } = require('./ai');
const { loadSkills } = require('./skillLoader');
const { v4: uuidv4 } = require('uuid');
const { runSql, queryOne, queryObjects } = require('../database');
const { startPipeline } = require('./stageManager');

const ai = new ContentAI();
let skillsLoaded = false;

async function initialize() {
  if (skillsLoaded) return;
  const skills = await loadSkills();
  if (skills && skills.systemPrompt) {
    ContentAI.setSkillsContext(skills.systemPrompt);
    console.log('[Orchestrator] Skills carregadas e injetadas na IA');
  }
  skillsLoaded = true;
}

async function processIncomingMessage(chatId, text) {
  await initialize();

  console.log(`[Orchestrator] Processando mensagem: ${text.substring(0, 60)}`);

  const data = await ai.generateCompleteSuggestion(text);

  const combined = {
    topic: data.topic,
    platform: data.platform,
    format: data.format,
    duration: data.duration,
    hook: data.hook,
    approach: data.approach,
    briefing: data.briefing,
    structure: data.structure || [],
    cta: data.cta,
    hashtags: data.hashtags || [],
    angles: data.angles || [],
    targetAudience: data.targetAudience,
    contentIdeas: data.contentIdeas || [],
    originalMessage: text,
    status: 'awaiting_approval',
    source: data.briefing?.includes('Criar conteudo sobre') ? 'fallback' : 'gemini'
  };

  const suggestionId = uuidv4();
  const ok = runSql(
    `INSERT INTO suggestions (id, briefing_id, keyword_used, platform, format, title, description, hashtags, content_generated, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [suggestionId, null, 'telegram_input', data.platform, data.format,
     data.topic, data.briefing, JSON.stringify(data.hashtags || []), JSON.stringify(combined),
     'pending', Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
  );

  if (!ok) {
    console.error('[Orchestrator] Falha ao salvar sugestao no banco');
    return { message: 'Erro ao salvar sugestao. Tente novamente.', suggestionId: null };
  }

  const msg = buildSuggestionV2(combined, suggestionId);
  return { message: msg, suggestionId };
}

function buildSuggestionV2(data, suggestionId) {
  const code = suggestionId.substring(0, 4);

  let msg = `💡 Sugestao\n`;
  msg += `📌 ${data.topic}\n`;
  msg += `📱 ${data.platform} · 🎬 ${data.format} · ⏱ ${data.duration || ''}\n`;
  msg += `🎯 ${data.hook}\n`;
  msg += `👥 ${data.targetAudience || ''}\n\n`;

  msg += `✅ /ok${code}  ✏️ /ed${code}  ❌ /no${code}`;

  return msg;
}

async function handleApprove(suggestionId, chatId) {
  const suggestion = queryOne('SELECT * FROM suggestions WHERE id = ?', [suggestionId]);
  if (!suggestion) {
    const count = queryOne('SELECT COUNT(*) as total FROM suggestions');
    return { message: 'Sugestao expirada. Envie um novo tema.', postIds: [] };
  }

  const data = JSON.parse(suggestion.content_generated || '{}');
  const now = Math.floor(Date.now() / 1000);
  const postIds = [];

  const ideas = (data.contentIdeas && data.contentIdeas.length > 0)
    ? data.contentIdeas
    : [{ title: data.topic, platform: data.platform, format: data.format, description: data.briefing || '' }];

  for (const idea of ideas) {
    const postId = uuidv4();
    postIds.push(postId);

    let generatedContent = null;
    let imageData = null;

    try {
      generatedContent = await ai.generateFullContent(
        idea.title || data.topic,
        idea.description || data.briefing || '',
        idea.platform || data.platform,
        idea.format || 'post'
      );
    } catch (e) {
      console.error('[Approve] Erro ao gerar texto:', e.message);
    }

    try {
      const imgResult = await ai.generateImage(
        `${data.topic} - conteudo para redes sociais sobre cabelos cacheados`,
        'professional'
      );
      if (imgResult && imgResult.imageUrl) {
        imageData = imgResult;
      }
    } catch (e) {
      console.error('[Approve] Erro ao gerar imagem:', e.message);
    }

    const postContent = {
      sourceSuggestion: suggestionId,
      hook: data.hook,
      approach: data.approach,
      structure: data.structure,
      format: idea.format || data.format,
      fullContent: generatedContent,
      hasImage: !!imageData
    };

    runSql(
      `INSERT INTO posts (id, title, description, platform, stage, assigned_to, content, hashtags, scheduled_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [postId, idea.title || data.topic, idea.description || data.briefing || '',
       idea.platform || data.platform, 'criar', 'Carla Cria',
       JSON.stringify(postContent),
       JSON.stringify(data.hashtags || []), '', now, now]
    );

    runSql('UPDATE suggestions SET status = ?, updated_at = ? WHERE id = ?',
      ['approved', now, suggestionId]);

    startPipeline(postId, chatId).catch(err => {
      console.error(`[Orchestrator] Erro na pipeline do post ${postId}:`, err.message);
    });
  }

  return { message: `Aprovado! ${ideas.length} peca(s) criada(s). A pipeline ja esta rodando.`, postIds };
}

async function handleEdit(suggestionId, instructions, chatId) {
  const suggestion = queryOne('SELECT * FROM suggestions WHERE id = ?', [suggestionId]);
  if (!suggestion) {
    return '❌ Sugestao nao encontrada.';
  }

  const data = JSON.parse(suggestion.content_generated || '{}');
  const refinePrompt = `Ajuste a sugestao de conteudo com base nas instrucoes abaixo.

INSTRUCOES DO USUARIO:
${instructions}

DADOS ATUAIS:
${JSON.stringify(data, null, 2)}

Retorne a sugestao ajustada no mesmo formato JSON:
{
  "topic": "...",
  "platform": "...",
  "format": "...",
  "briefing": "..."
}
`;

  const adjustedText = await generateText(refinePrompt);
  const adjusted = parseJSON(adjustedText);
  if (adjusted) {
    data.topic = adjusted.topic || data.topic;
    data.platform = adjusted.platform || data.platform;
    data.format = adjusted.format || data.format;
    data.briefing = adjusted.briefing || data.briefing;
  }

  data.status = 'awaiting_approval';
  data.editInstructions = instructions;

  const now = Math.floor(Date.now() / 1000);
  runSql('UPDATE suggestions SET title = ?, description = ?, content_generated = ?, updated_at = ? WHERE id = ?',
    [data.topic, data.briefing, JSON.stringify(data), now, suggestionId]);

  return `✏️ Sugestao ajustada!\n\n${buildSuggestionV2(data, suggestionId)}`;
}

async function handleReject(suggestionId, chatId) {
  const now = Math.floor(Date.now() / 1000);
  runSql('UPDATE suggestions SET status = ?, updated_at = ? WHERE id = ?',
    ['rejected', now, suggestionId]);
  return '❌ Sugestao rejeitada. Envie uma nova mensagem quando quiser!';
}

module.exports = { initialize, processIncomingMessage, handleApprove, handleEdit, handleReject };
