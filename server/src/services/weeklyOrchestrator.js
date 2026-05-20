const { v4: uuidv4 } = require('uuid');
const { runSql, queryOne, queryObjects } = require('../database');
const { executeSquad, getBrandContext } = require('./squadManager');
const ContentAI = require('./ai');
const MediaGenerator = require('./mediaGenerator');

const ai = new ContentAI();
const mediaGen = new MediaGenerator();

let activeCycleId = null;
let isPaused = false;
let notifyCallback = null;
let activeSingleInput = null;

function setNotifyCallback(cb) {
  notifyCallback = cb;
}

function setPaused(val) {
  isPaused = val;
}

function isCyclePaused() {
  return isPaused;
}

function getActiveCycle() {
  if (activeCycleId) {
    return queryOne('SELECT * FROM weekly_cycles WHERE id = ?', [activeCycleId]);
  }
  return queryOne("SELECT * FROM weekly_cycles WHERE status IN ('planning','awaiting_approval','approved') ORDER BY created_at DESC LIMIT 1");
}

function getActiveSingleInput() {
  if (activeSingleInput) {
    return queryOne('SELECT * FROM suggestions WHERE id = ?', [activeSingleInput]);
  }
  return queryOne("SELECT * FROM suggestions WHERE status IN ('pending') AND keyword_used = 'single_input' ORDER BY created_at DESC LIMIT 1");
}

// ─── CICLO SEMANAL COMPLETO ───

async function startWeeklyCycle(chatId = null) {
  if (isPaused) {
    console.log('[WeeklyOrch] Ciclo semanal pausado. Ignorando trigger.');
    return null;
  }

  console.log('[WeeklyOrch] Iniciando ciclo semanal...');

  const existing = getActiveCycle();
  if (existing && existing.status !== 'rejected' && existing.status !== 'completed') {
    console.log(`[WeeklyOrch] Ciclo ${existing.id} já está em ${existing.status}. Ignorando.`);
    return existing;
  }

  const cycleId = uuidv4();
  const now = Math.floor(Date.now() / 1000);

  runSql(
    'INSERT INTO weekly_cycles (id, status, telegram_chat_id, squad1_output, squad2_output, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [cycleId, 'planning', chatId || '', '{}', '{}', now, now]
  );

  activeCycleId = cycleId;
  const brandCtx = getBrandContext();

  try {
    // ─── SQUAD 1: PESQUISA ───
    console.log('[WeeklyOrch] >>> SQUAD 1: Pesquisa');
    const squad1Input = 'Pesquise tendências atuais de cabelos cacheados no Brasil, foco Nordeste/BA. Identifique ganchos de conteúdo relevantes para a semana.';
    const squad1Output = await executeSquad(1, squad1Input, brandCtx);
    runSql('UPDATE weekly_cycles SET squad1_output = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(squad1Output), Math.floor(Date.now() / 1000), cycleId]);

    if (!squad1Output || (Array.isArray(squad1Output) && squad1Output.length === 0)) {
      throw new Error('Squad 1 não retornou ganchos válidos');
    }

    // ─── SQUAD 2: ESTRATÉGIA ───
    console.log('[WeeklyOrch] >>> SQUAD 2: Estratégia');
    const squad2Output = await executeSquad(2, squad1Output, brandCtx);
    runSql('UPDATE weekly_cycles SET squad2_output = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(squad2Output), Math.floor(Date.now() / 1000), cycleId]);

    if (!squad2Output || !squad2Output.posts || squad2Output.posts.length === 0) {
      throw new Error('Squad 2 não retornou plano semanal válido');
    }

    // ─── PARA CADA POST: SQUAD 3 → MEDIA → SQUAD 4 ───
    console.log(`[WeeklyOrch] >>> Processando ${squad2Output.posts.length} posts via Squad 3 + Media + 4`);
    const postsData = [];

    for (let i = 0; i < squad2Output.posts.length; i++) {
      const postPlan = squad2Output.posts[i];
      const postId = postPlan.id || uuidv4();
      const currentPost = {
        ...postPlan,
        id: postId,
        ordem: i + 1,
        status: 'processing'
      };

      console.log(`[WeeklyOrch] Post ${i + 1}/${squad2Output.posts.length}: ${postPlan.gancho_base || postPlan.tipo}`);

      // SQUAD 3: CRIAÇÃO
      const squad3Input = {
        titulo: postPlan.gancho_base || postPlan.tipo,
        plataforma: postPlan.plataforma,
        tipo: postPlan.tipo,
        objetivo: postPlan.objetivo,
        gancho: postPlan.gancho_base,
        headline_principal: 'UM KIT, DOIS DIAS DE CACHO',
        headline_retargeting: 'O KIT QUE FAZ O CACHO DURAR',
        headline_tiktok: 'CACHO DEFINIDO DO BANHO AO SHOW'
      };

      let squad3Output = null;
      let squad4Output = null;
      let mediaOutput = null;
      let qaAttempts = 0;
      const MAX_QA_ATTEMPTS = 2;

      while (qaAttempts <= MAX_QA_ATTEMPTS) {
        qaAttempts++;

        // Squad 3
        squad3Output = await executeSquad(3, squad3Input, brandCtx);

        // GERAR MÍDIA REAL baseada no formato
        const mediaFormat = squad3Output?.formato_midia || postPlan.tipo || 'feed';
        const copy = squad3Output?.copy || '';
        try {
          mediaOutput = await generateRealMedia(
            squad3Output,
            postPlan.gancho_base || postPlan.tipo || 'conteudo',
            postPlan.plataforma || 'instagram',
            mediaFormat
          );
          console.log(`[WeeklyOrch] Midia gerada para ${postId}: ${mediaFormat}`);
        } catch (mediaErr) {
          console.warn(`[WeeklyOrch] Falha ao gerar midia para ${postId}: ${mediaErr.message}`);
        }

        // Squad 4: QA
        const squad4Input = {
          post: currentPost,
          copy_gerado: squad3Output,
          media_gerada: mediaOutput
        };
        squad4Output = await executeSquad(4, squad4Input, brandCtx);

        const score = squad4Output?.score || 0;
        console.log(`[WeeklyOrch] QA Tentativa ${qaAttempts}: score ${score}/100`);

        if (score >= 70) {
          console.log(`[WeeklyOrch] Post ${postId} aprovado no QA (score ${score})`);
          currentPost.status = 'approved';
          break;
        }

        if (qaAttempts < MAX_QA_ATTEMPTS) {
          console.log(`[WeeklyOrch] Post ${postId} score ${score} < 70. Re-gerando...`);

          if (squad4Output?.copy_final) {
            squad3Input.copy_revisado = squad4Output.copy_final;
          }
          if (squad4Output?.notas_revisao) {
            squad3Input.notas_revisao = squad4Output.notas_revisao;
          }
        } else {
          console.log(`[WeeklyOrch] Post ${postId} não passou no QA após ${MAX_QA_ATTEMPTS} tentativas. Usando última versão.`);
          currentPost.status = 'approved_with_warnings';
        }
      }

      const postEntry = {
        id: postId,
        ordem: i + 1,
        plano: postPlan,
        squad3_output: { ...squad3Output, media: mediaOutput },
        squad4_output: squad4Output,
        media: mediaOutput,
        status: currentPost.status,
        score_final: squad4Output?.score || 0
      };

      postsData.push(postEntry);

      // Salvar no banco como post
      const postTitle = squad3Output?.copy?.substring(0, 60) || postPlan.gancho_base || 'Post sem título';
      const now = Math.floor(Date.now() / 1000);
      runSql(
        `INSERT OR REPLACE INTO cycle_posts (id, cycle_id, ordem, plataforma, tipo, objetivo, titulo, squad3_output, squad4_output, score, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [postId, cycleId, i + 1, postPlan.plataforma, postPlan.tipo, postPlan.objetivo,
         postTitle, JSON.stringify({ ...(squad3Output || {}), media: mediaOutput }), JSON.stringify(squad4Output || {}),
         squad4Output?.score || 0, currentPost.status, now, now]
      );
    }

    // ─── ATUALIZAR CICLO PARA AGUARDANDO APROVAÇÃO ───
    runSql('UPDATE weekly_cycles SET status = ?, posts_data = ?, updated_at = ? WHERE id = ?',
      ['awaiting_approval', JSON.stringify(postsData), Math.floor(Date.now() / 1000), cycleId]);

    // ─── MONTAR MENSAGEM DE APROVAÇÃO ───
    const approvalMsg = buildApprovalMessage(squad2Output, postsData);

    if (chatId) {
      if (notifyCallback) {
        notifyCallback(chatId, approvalMsg);
      }
    } else {
      const existingConfig = queryOne('SELECT chat_id FROM telegram_config WHERE enabled = 1 ORDER BY created_at DESC LIMIT 1');
      if (existingConfig?.chat_id) {
        if (notifyCallback) {
          notifyCallback(existingConfig.chat_id, approvalMsg);
        }
        runSql('UPDATE weekly_cycles SET telegram_chat_id = ? WHERE id = ?',
          [existingConfig.chat_id, cycleId]);
      }
    }

    console.log('[WeeklyOrch] Ciclo semanal concluído. Aguardando aprovação.');
    return { cycleId, message: approvalMsg, postsCount: postsData.length };

  } catch (err) {
    console.error('[WeeklyOrch] Erro no ciclo semanal:', err.message);
    runSql('UPDATE weekly_cycles SET status = ?, updated_at = ? WHERE id = ?',
      ['error', Math.floor(Date.now() / 1000), cycleId]);
    activeCycleId = null;
    throw err;
  }
}

// ─── MENSAGEM DE APROVAÇÃO ───

function buildApprovalMessage(squad2Output, postsData) {
  const postCount = postsData.length;
  const platformCounts = countPlatforms(postsData);
  const mainHook = squad2Output.foco_principal || (
    Array.isArray(squad2Output) ? squad2Output[0]?.gancho : 'Conteúdo semanal'
  );

  const platformSummary = Object.entries(platformCounts)
    .map(([p, c]) => `${p}(${c})`)
    .join(' ');

  let msg = '━━━━━━━━━━━━━━━\n';
  msg += '📋 PLANO SEMANAL CACHOVIVA\n';
  msg += '━━━━━━━━━━━━━━━\n';
  msg += `📱 ${postCount} posts planejados | ${platformSummary}\n`;
  msg += `🎯 Foco: ${mainHook}\n\n`;
  msg += 'DESTAQUES:\n';

  const highlights = postsData.slice(0, 5);
  highlights.forEach((p, i) => {
    const titulo = p.plano?.gancho_base || p.plano?.tipo || `Post ${i + 1}`;
    const plat = getPlatformEmoji(p.plano?.plataforma) + ' ' + capitalize(p.plano?.plataforma || '');
    const dia = p.plano?.data_hora_sugerida || '—';
    msg += `${i + 1}. ${titulo} — ${plat} — ${dia}\n`;
  });

  if (postsData.length > 5) {
    msg += `... e mais ${postsData.length - 5} post(s)\n`;
  }

  msg += '\n✅ /ok_semana — Aprovar tudo\n';
  msg += '✏️ /ajustar [id] [texto] — Envie o que quer mudar\n';
  msg += '❌ /rejeitar — Cancelar ciclo\n';
  msg += '━━━━━━━━━━━━━━━';

  return msg;
}

function countPlatforms(postsData) {
  const counts = {};
  for (const p of postsData) {
    const plat = p.plano?.plataforma || 'instagram';
    counts[capitalize(plat)] = (counts[capitalize(plat)] || 0) + 1;
  }
  return counts;
}

function getPlatformEmoji(platform) {
  const map = {
    tiktok: '🎵',
    instagram: '📸',
    facebook: '👍',
    whatsapp: '💬',
    youtube: '▶️',
    twitter: '🐦',
    linkedin: '💼'
  };
  return map[(platform || '').toLowerCase()] || '📱';
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── GERAÇÃO DE MÍDIA REAL ───

async function generateRealMedia(squad3Output, topic, platform, format) {
  const mediaResult = { images: [], videoScript: null, carousel: null, mediaFiles: [] };
  const promptImagem = squad3Output?.prompt_imagem || `${topic} - conteudo para ${platform}`;
  console.log(`[Media] generateRealMedia: formato=${format}, plataforma=${platform}, topic="${topic.substring(0, 60)}", prompt="${promptImagem.substring(0, 80)}"`);

  if (format === 'reels' || format === 'shorts' || format === 'video' || format === 'short') {
    try {
      const videoData = await ai.generateVideoScript(topic, format === 'shorts' ? '30s' : '60s');
      mediaResult.videoScript = videoData;

      for (let s = 0; s < (videoData.scenes || []).length; s++) {
        const scene = videoData.scenes[s];
        const scenePrompt = `Cena de video para ${platform}: ${scene.visual || scene.script}, estilo CachoViva, praia tropical golden hour`;
        try {
          const frame = await ai.generateImage(scenePrompt, 'cinematic');
          if (frame?.imageUrl) {
            mediaResult.images.push({ scene: s, url: frame.imageUrl, time: scene.time, script: scene.script });
            mediaResult.mediaFiles.push(frame.imageUrl);
          } else {
            console.warn(`[Media] Frame ${s} sem imagem gerada`);
          }
        } catch (e) {
          console.warn(`[Media] Erro frame ${s}: ${e.message}`);
        }
      }
    } catch (e) {
      console.warn(`[Media] Erro video script: ${e.message}`);
    }
  }

  if (format === 'carrossel' || format === 'carousel') {
    try {
      const carouselData = await ai.generateCarousel(topic, 5);
      mediaResult.carousel = carouselData;
      for (let s = 0; s < (carouselData.slides || []).length; s++) {
        const slide = carouselData.slides[s];
        const slidePrompt = `Slide ${s+1} de carrossel Instagram: ${slide.visual || slide.title}, cores CachoViva, praia tropical`;
        try {
          const img = await ai.generateImage(slidePrompt, 'professional');
          if (img?.imageUrl) {
            mediaResult.images.push({ scene: s, url: img.imageUrl, title: slide.title, text: slide.text });
            mediaResult.mediaFiles.push(img.imageUrl);
          } else {
            console.warn(`[Media] Slide ${s} sem imagem gerada`);
          }
        } catch (e) {
          console.warn(`[Media] Erro slide ${s}: ${e.message}`);
        }
      }
    } catch (e) {
      console.warn(`[Media] Erro carrossel: ${e.message}`);
    }
  }

  if (format === 'feed' || format === 'post' || format === 'status' || format === 'story' || format === 'stories') {
    try {
      const mainImage = await ai.generateImage(promptImagem, 'professional');
      if (mainImage?.imageUrl) {
        mediaResult.images.push({ scene: 0, url: mainImage.imageUrl, type: 'main' });
        mediaResult.mediaFiles.push(mainImage.imageUrl);
        console.log(`[Media] Imagem principal gerada com sucesso`);
      } else {
        console.warn(`[Media] Imagem principal retornou null`);
      }

      if (format === 'feed') {
        try {
          const varImage = await ai.generateImage(`${promptImagem}, diferente angulo`, 'professional');
          if (varImage?.imageUrl) {
            mediaResult.images.push({ scene: 1, url: varImage.imageUrl, type: 'variation' });
            mediaResult.mediaFiles.push(varImage.imageUrl);
          }
        } catch (e) {
          console.warn(`[Media] Erro variacao: ${e.message}`);
        }
      }
    } catch (e) {
      console.warn(`[Media] Erro imagem principal: ${e.message}`);
    }
  }

  console.log(`[Media] Resultado final: ${mediaResult.images.length} imagens, videoScript=${!!mediaResult.videoScript}, carrossel=${!!mediaResult.carousel}`);

  return mediaResult;
}

// ─── PROCESSAMENTO DE INPUT ÚNICO (via Telegram) ───

async function processSingleInput(text, chatId) {
  if (isPaused) {
    const msg = '⏸️ Sistema pausado. Use /retomar para ativar.';
    if (notifyCallback && chatId) notifyCallback(chatId, msg);
    return { message: msg };
  }

  console.log(`[SingleInput] Processando: "${text.substring(0, 80)}"`);
  const brandCtx = getBrandContext();
  const now = Math.floor(Date.now() / 1000);

  // Salvar mensagem como briefing rápido
  const briefingId = uuidv4();
  runSql(
    'INSERT INTO briefings (id, content, platform_focus, active, source, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?, ?)',
    [briefingId, text, 'instagram', 'telegram_input', now, now]
  );

  try {
    // SQUAD 2: ESTRATÉGIA (pula Squad1 para input direto)
    console.log('[SingleInput] >>> SQUAD 2: Estratégia');
    const squad2Input = {
      input_usuario: text,
      instrucao: 'Defina a melhor plataforma, formato e objetivo para este conteúdo como post único avulso',
      quantidade_posts: 1
    };
    const squad2Output = await executeSquad(2, squad2Input, brandCtx);
    const postPlan = squad2Output?.posts?.[0] || {
      id: uuidv4(),
      plataforma: 'instagram',
      tipo: 'feed',
      objetivo: 'alcance',
      gancho_base: text.substring(0, 80),
      data_hora_sugerida: new Date().toISOString()
    };

    const postId = postPlan.id || uuidv4();
    const gancho = postPlan.gancho_base || text.substring(0, 80);

    // SQUAD 3: CRIAÇÃO com mídia real
    console.log('[SingleInput] >>> SQUAD 3: Criação');
    const squad3Input = {
      titulo: gancho,
      plataforma: postPlan.plataforma || 'instagram',
      tipo: postPlan.tipo || 'feed',
      objetivo: postPlan.objetivo || 'alcance',
      gancho: gancho,
      input_original: text
    };

    const squad3Output = await executeSquad(3, squad3Input, brandCtx);

    // Gerar mídia real
    const mediaFormat = squad3Output?.formato_midia || postPlan.tipo || 'feed';
    let mediaOutput = null;
    try {
      mediaOutput = await generateRealMedia(squad3Output, gancho, postPlan.plataforma || 'instagram', mediaFormat);
      console.log(`[SingleInput] Midia gerada: ${mediaOutput?.images?.length || 0} imagens, videoScript=${!!mediaOutput?.videoScript}, carrossel=${!!mediaOutput?.carousel}`);
      if (mediaOutput?.images?.length > 0) {
        console.log(`[SingleInput] 1a imagem URL: ${(mediaOutput.images[0].url || 'sem url').substring(0, 100)}`);
      }
    } catch (mediaErr) {
      console.warn(`[SingleInput] Erro midia: ${mediaErr.message}`, mediaErr.stack?.substring(0, 200));
    }

    // SQUAD 4: QA
    console.log('[SingleInput] >>> SQUAD 4: QA');
    const squad4Input = { post: { id: postId, ...postPlan }, copy_gerado: squad3Output, media_gerada: mediaOutput };
    let squad4Output = await executeSquad(4, squad4Input, brandCtx);
    let score = squad4Output?.score || 0;

    if (score < 70) {
      console.log(`[SingleInput] Score ${score} < 70, re-gerando...`);
      squad3Input.copy_revisado = squad4Output?.copy_final;
      squad3Input.notas_revisao = squad4Output?.notas_revisao;

      const squad3Retry = await executeSquad(3, squad3Input, brandCtx);
      if (squad3Retry?.copy) squad3Output.copy = squad3Retry.copy;
      if (squad3Retry?.hashtags) squad3Output.hashtags = squad3Retry.hashtags;

      const squad4Retry = await executeSquad(4, { post: { id: postId, ...postPlan }, copy_gerado: squad3Output }, brandCtx);
      if (squad4Retry) {
        squad4Output = squad4Retry;
        score = squad4Output?.score || 0;
      }
    }

    // Salvar como sugestão pendente
    const suggestionId = uuidv4();
    const copyFinal = squad4Output?.copy_final || squad3Output?.copy || '';
    const hashtags = squad3Output?.hashtags || [];

    runSql(
      `INSERT INTO suggestions (id, briefing_id, keyword_used, platform, format, title, description, hashtags, content_generated, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [suggestionId, briefingId, 'single_input', postPlan.plataforma || 'instagram',
       postPlan.tipo || 'feed', gancho, copyFinal.substring(0, 200),
       JSON.stringify(hashtags),
       JSON.stringify({
         squad3: squad3Output, squad4: squad4Output, media: mediaOutput,
         plataforma: postPlan.plataforma, tipo: postPlan.tipo, objetivo: postPlan.objetivo
       }),
       'pending', now, now]
    );

    activeSingleInput = suggestionId;
    const code = suggestionId.substring(0, 4);

    // Limpar texto: remover JSON remnants e múltiplos \n
    let cleanCopy = copyFinal
      .replace(/\{"copy":/g, '')
      .replace(/"}$/g, '')
      .replace(/\\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Montar mensagem de aprovação (formato executivo)
    let msg = '━━━━━━━━━━━━━━━\n';
    msg += `💡 NOVO CONTEÚDO\n`;
    msg += '━━━━━━━━━━━━━━━\n';
    msg += `📌 ${gancho}\n`;
    msg += `📱 ${capitalize(postPlan.plataforma || 'instagram')} · 🎬 ${postPlan.tipo || 'feed'} · 🎯 ${postPlan.objetivo || 'alcance'}\n`;
    msg += `📝 Score QA: ${score}/100\n\n`;

    if (cleanCopy) {
      const preview = cleanCopy.substring(0, 200);
      msg += `${preview}${cleanCopy.length > 200 ? '...' : ''}\n\n`;
    }

    if (mediaOutput?.images?.length > 0) {
      msg += `🖼️ ${mediaOutput.images.length} mídia(s) gerada(s)\n`;
    }
    if (mediaOutput?.videoScript) {
      msg += `🎬 Roteiro de vídeo gerado\n`;
    }

    msg += `\n📋 /post ${suggestionId.substring(0, 8)} — Ver detalhes\n`;
    msg += '━━━━━━━━━━━━━━━';

    // Enviar com foto + botões via Telegram
    try {
      const { sendApproval } = require('./telegram');
      await sendApproval(chatId, msg, code, mediaOutput);
    } catch (e) {
      console.error('[SingleInput] Erro ao enviar aprovacao:', e.message);
      if (notifyCallback) notifyCallback(chatId, msg);
    }

    console.log(`[SingleInput] Aguardando aprovação: ${suggestionId}`);
    return { message: msg, suggestionId, postId, squad3: squad3Output, squad4: squad4Output, media: mediaOutput };

  } catch (err) {
    console.error('[SingleInput] Erro:', err.message);
    const msg = `❌ Erro ao processar: ${err.message}`;
    if (notifyCallback && chatId) notifyCallback(chatId, msg);
    return { message: msg };
  }
}

// ─── APROVAR CICLO ───

async function approveCycle(cycleId = null) {
  const cycle = cycleId
    ? queryOne('SELECT * FROM weekly_cycles WHERE id = ?', [cycleId])
    : getActiveCycle();

  if (!cycle) {
    return { success: false, message: 'Nenhum ciclo ativo para aprovar.' };
  }

  if (cycle.status !== 'awaiting_approval') {
    return { success: false, message: `Ciclo em status "${cycle.status}" não pode ser aprovado.` };
  }

  console.log(`[WeeklyOrch] Aprovando ciclo ${cycle.id}...`);

  const postsData = JSON.parse(cycle.posts_data || '[]');
  const now = Math.floor(Date.now() / 1000);
  const postIds = [];

  for (const p of postsData) {
    const postId = p.id || uuidv4();

    const copyFinal = p.squad4_output?.copy_final || p.squad3_output?.copy || '';
    const hashtags = p.squad3_output?.hashtags || [];
    const media = p.media || p.squad3_output?.media || null;

    runSql(
      `INSERT OR REPLACE INTO posts (id, title, description, platform, stage, assigned_to, content, hashtags, scheduled_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [postId,
       p.titulo || p.plano?.gancho_base || 'Post',
       copyFinal.substring(0, 300),
       p.plano?.plataforma || 'instagram',
       'publicar',
       'Gabi Publica',
       JSON.stringify({
         copy: copyFinal,
         media: media,
         roteiro_video: p.squad3_output?.roteiro_video || p.squad3_output?.media?.videoScript || '',
         formato: p.squad3_output?.formato_midia || p.plano?.tipo || 'feed',
         squad3: p.squad3_output,
         squad4: p.squad4_output
       }),
       JSON.stringify(hashtags),
       p.plano?.data_hora_sugerida || '',
       now, now]
    );

    postIds.push(postId);

    // EXECUTAR SQUAD 5: PUBLICAÇÃO (assíncrono, não bloqueia)
    try {
      const squad5Input = {
        post_id: postId,
        plataforma: p.plano?.plataforma || 'instagram',
        tipo: p.plano?.tipo || 'feed',
        copy: copyFinal,
        hashtags,
        media: media,
        agendado_para: p.plano?.data_hora_sugerida || null
      };
      executeSquad(5, squad5Input, getBrandContext()).then(squad5Result => {
        console.log(`[Squad5] Post ${postId} resultado:`, squad5Result?.status || 'simulated');

        // Registrar publicação
        runSql(
          'INSERT INTO scheduled_publishes (id, post_id, platform, scheduled_date, status, published_at) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), postId, p.plano?.plataforma || 'instagram',
           p.plano?.data_hora_sugerida || new Date().toISOString().split('T')[0],
           squad5Result?.status || 'pending', now]
        );

        // AGENDAR SQUAD 6: Métricas para 24h depois
        setTimeout(async () => {
          try {
            const metricsDigest = await generateMetricsDigest();
            if (metricsDigest?.mensagem_telegram && cycle.telegram_chat_id) {
              const chatId = cycle.telegram_chat_id;
              if (notifyCallback) {
                notifyCallback(chatId, metricsDigest.mensagem_telegram);
              }
            }
          } catch (metricsErr) {
            console.error(`[Squad6] Erro ao coletar metricas:`, metricsErr.message);
          }
        }, 24 * 60 * 60 * 1000);
      }).catch(err => {
        console.error(`[Squad5] Erro publicacao ${postId}:`, err.message);
      });
    } catch (err) {
      console.error(`[Squad5] Erro ao iniciar publicacao:`, err.message);
    }
  }

  runSql('UPDATE weekly_cycles SET status = ?, approved_at = ?, updated_at = ? WHERE id = ?',
    ['approved', now, now, cycle.id]);

  activeCycleId = null;

  const msg = `✅ Ciclo aprovado! ${postIds.length} post(s) registrados.\n⚠️ Publicação simulada (sem API de redes sociais configurada).\n📊 Squad6 métricas em 24h.\n📋 Use /post <id> para ver detalhes de cada post.`;
  return { success: true, message: msg, postIds, cycleId: cycle.id };
}

// ─── AJUSTAR POST ───

async function adjustPost(cycleId, postId, instructions) {
  const cycle = cycleId
    ? queryOne('SELECT * FROM weekly_cycles WHERE id = ?', [cycleId])
    : getActiveCycle();

  if (!cycle) {
    return { success: false, message: 'Nenhum ciclo ativo.' };
  }

  const postsData = JSON.parse(cycle.posts_data || '[]');
  const postIdx = postsData.findIndex(p => p.id === postId);
  if (postIdx === -1) {
    return { success: false, message: `Post ${postId} não encontrado no ciclo.` };
  }

  const currentPost = postsData[postIdx];
  const brandCtx = getBrandContext();

  console.log(`[WeeklyOrch] Ajustando post ${postId}: "${instructions.substring(0, 60)}"`);

  const squad3Input = {
    ...(currentPost.plano || {}),
    instrucoes_ajuste: instructions,
    copy_anterior: currentPost.squad3_output?.copy || '',
    headline_principal: 'UM KIT, DOIS DIAS DE CACHO',
    headline_retargeting: 'O KIT QUE FAZ O CACHO DURAR',
    headline_tiktok: 'CACHO DEFINIDO DO BANHO AO SHOW'
  };

  const squad3Output = await executeSquad(3, squad3Input, brandCtx);

  const squad4Input = { post: currentPost, copy_gerado: squad3Output };
  const squad4Output = await executeSquad(4, squad4Input, brandCtx);

  const score = squad4Output?.score || 0;
  let finalCopy = squad3Output;

  if (score < 70 && squad4Output?.copy_final) {
    finalCopy = { ...squad3Output, copy: squad4Output.copy_final };
  }

  postsData[postIdx].squad3_output = finalCopy;
  postsData[postIdx].squad4_output = squad4Output;
  postsData[postIdx].status = score >= 70 ? 'approved' : 'approved_with_warnings';
  postsData[postIdx].score_final = score;

  const now = Math.floor(Date.now() / 1000);
  runSql('UPDATE weekly_cycles SET posts_data = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(postsData), now, cycle.id]);

  runSql(
    `UPDATE cycle_posts SET squad3_output = ?, squad4_output = ?, score = ?, status = ?, updated_at = ? WHERE id = ? AND cycle_id = ?`,
    [JSON.stringify(finalCopy), JSON.stringify(squad4Output), score,
     postsData[postIdx].status, now, postId, cycle.id]
  );

  const titulo = currentPost.plano?.gancho_base || 'Post';
  let msg = `✏️ Post ajustado!\n\n📌 ${titulo}\n📱 ${capitalize(currentPost.plano?.plataforma || '')}\n🎯 Score QA: ${score}/100\n\n`;

  if (finalCopy?.copy) {
    msg += `📝 Preview:\n${finalCopy.copy.substring(0, 200)}${finalCopy.copy.length > 200 ? '...' : ''}\n\n`;
  }

  msg += '✅ /ok_semana — Aprovar tudo\n';
  msg += `✏️ /ajustar ${postId} [texto] — Ajustar novamente\n`;
  msg += '❌ /rejeitar — Cancelar ciclo';

  return { success: true, message: msg, postId, score };
}

// ─── REJEITAR CICLO ───

async function rejectCycle(cycleId = null) {
  const cycle = cycleId
    ? queryOne('SELECT * FROM weekly_cycles WHERE id = ?', [cycleId])
    : getActiveCycle();

  if (!cycle) {
    return { success: false, message: 'Nenhum ciclo ativo para rejeitar.' };
  }

  const now = Math.floor(Date.now() / 1000);
  runSql('UPDATE weekly_cycles SET status = ?, updated_at = ? WHERE id = ?',
    ['rejected', now, cycle.id]);

  activeCycleId = null;

  return { success: true, message: '❌ Ciclo rejeitado. Um novo ciclo será iniciado na próxima segunda-feira às 7h.' };
}

// ─── STATUS ───

async function getStatusSummary() {
  const publishedThisWeek = queryObjects(
    "SELECT COUNT(*) as cnt FROM posts WHERE stage IN ('medir','publicar') AND published_date != '' AND created_at > strftime('%s','now','-7 days')"
  );
  const nextScheduled = queryOne(
    "SELECT title, platform, scheduled_date FROM posts WHERE stage = 'publicar' AND scheduled_date != '' ORDER BY scheduled_date ASC LIMIT 1"
  );
  const topPost = queryOne(
    "SELECT title, metrics FROM posts WHERE stage = 'medir' AND metrics != 'null' AND metrics IS NOT NULL ORDER BY json_extract(metrics, '$.likes') DESC LIMIT 1"
  );
  const cycle = getActiveCycle();

  let msg = `📊 STATUS CACHOVIVA\n\n`;
  msg += `📅 Semana: ${publishedThisWeek[0]?.cnt || 0} posts publicados\n`;

  if (nextScheduled) {
    msg += `⏭️ Próximo: "${nextScheduled.title}" — ${nextScheduled.platform} — ${nextScheduled.scheduled_date}\n`;
  } else {
    msg += `⏭️ Nenhum post agendado\n`;
  }

  if (topPost && topPost.metrics) {
    try {
      const m = typeof topPost.metrics === 'string' ? JSON.parse(topPost.metrics) : topPost.metrics;
      msg += `🔥 Top post: "${topPost.title}" — ❤️ ${m.likes || 0} | 💬 ${m.comments || 0}\n`;
    } catch { msg += `🔥 Top post: "${topPost.title}"\n`; }
  }

  if (cycle) {
    msg += `🔄 Ciclo: ${getStatusLabel(cycle.status)}\n`;
  }

  if (isPaused) {
    msg += `⏸️ Sistema pausado\n`;
  }

  return msg;
}

function getStatusLabel(status) {
  const labels = {
    planning: 'Planejando',
    awaiting_approval: 'Aguardando aprovação',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
    completed: 'Concluído',
    error: 'Erro'
  };
  return labels[status] || status;
}

// ─── MÉTRICAS ───

async function generateMetricsDigest() {
  const posts = queryObjects(
    "SELECT title, platform, metrics, published_date FROM posts WHERE stage = 'medir' AND metrics != 'null' AND metrics IS NOT NULL ORDER BY created_at DESC LIMIT 20"
  );

  if (posts.length === 0) {
    return {
      mensagem_telegram: '📊 Nenhum dado de métricas disponível ainda.',
      recomendacao: 'Aguardar publicações para gerar insights.',
      dados_brutos: {}
    };
  }

  const totalLikes = posts.reduce((acc, p) => {
    try {
      const m = typeof p.metrics === 'string' ? JSON.parse(p.metrics) : (p.metrics || {});
      return acc + (m.likes || 0);
    } catch { return acc; }
  }, 0);

  const totalComments = posts.reduce((acc, p) => {
    try {
      const m = typeof p.metrics === 'string' ? JSON.parse(p.metrics) : (p.metrics || {});
      return acc + (m.comments || 0);
    } catch { return acc; }
  }, 0);

  const totalShares = posts.reduce((acc, p) => {
    try {
      const m = typeof p.metrics === 'string' ? JSON.parse(p.metrics) : (p.metrics || {});
      return acc + (m.shares || 0);
    } catch { return acc; }
  }, 0);

  const totalReach = posts.reduce((acc, p) => {
    try {
      const m = typeof p.metrics === 'string' ? JSON.parse(p.metrics) : (p.metrics || {});
      return acc + (m.reach || 0);
    } catch { return acc; }
  }, 0);

  const platformStats = {};
  for (const p of posts) {
    try {
      const m = typeof p.metrics === 'string' ? JSON.parse(p.metrics) : (p.metrics || {});
      if (!platformStats[p.platform]) {
        platformStats[p.platform] = { likes: 0, comments: 0, shares: 0, reach: 0, count: 0 };
      }
      platformStats[p.platform].likes += m.likes || 0;
      platformStats[p.platform].comments += m.comments || 0;
      platformStats[p.platform].shares += m.shares || 0;
      platformStats[p.platform].reach += m.reach || 0;
      platformStats[p.platform].count += 1;
    } catch {}
  }

  const topPlatform = Object.entries(platformStats)
    .sort(([, a], [, b]) => (b.engagement || 0) - (a.engagement || 0))[0] || null;

  const sortedByLikes = [...posts].sort((a, b) => {
    try {
      const ma = typeof a.metrics === 'string' ? JSON.parse(a.metrics) : (a.metrics || {});
      const mb = typeof b.metrics === 'string' ? JSON.parse(b.metrics) : (b.metrics || {});
      return (mb.likes || 0) - (ma.likes || 0);
    } catch { return 0; }
  });

  const topPost = sortedByLikes[0];
  const topPostMetrics = topPost ? (typeof topPost.metrics === 'string' ? JSON.parse(topPost.metrics) : topPost.metrics) : {};

  const engagement = totalReach > 0 ? ((totalLikes + totalComments + totalShares) / totalReach * 100).toFixed(1) : '0';

  let msg = '📊 DIGEST DE MÉTRICAS CACHOVIVA\n';
  msg += '━━━━━━━━━━━━━━━\n\n';

  msg += `📅 Período: últimos ${posts.length} posts\n`;
  msg += `❤️ Curtidas: ${totalLikes.toLocaleString()}\n`;
  msg += `💬 Comentários: ${totalComments.toLocaleString()}\n`;
  msg += `🔁 Compartilhamentos: ${totalShares.toLocaleString()}\n`;
  msg += `👁️ Alcance total: ${totalReach.toLocaleString()}\n`;
  msg += `📊 Engajamento: ${engagement}%\n\n`;

  if (topPost) {
    msg += `🔥 POST TOP: "${topPost.title}"\n`;
    msg += `   ❤️ ${topPostMetrics.likes || 0} · 💬 ${topPostMetrics.comments || 0} · 🔁 ${topPostMetrics.shares || 0}\n\n`;
  }

  msg += '📱 POR PLATAFORMA:\n';
  for (const [plat, stats] of Object.entries(platformStats)) {
    const platEng = stats.reach > 0 ? ((stats.likes + stats.comments + stats.shares) / stats.reach * 100).toFixed(1) : '0';
    msg += `${getPlatformEmoji(plat)} ${capitalize(plat)}: ${stats.count} posts · ${platEng}% eng.\n`;
  }

  let recomendacao = 'Manter estratégia atual.';
  if (topPlatform && topPlatform[0]) {
    recomendacao = `Foco em ${capitalize(topPlatform[0])} — maior engajamento da semana. Aumentar frequência.`;
  }

  msg += `\n💡 Recomendação: ${recomendacao}`;

  const digestResult = await executeSquad(6, {
    mensagem_gerada: msg,
    recomendacao,
    dados_brutos: { totalLikes, totalComments, totalShares, totalReach, engagement, platformStats, topPost: topPost?.title }
  });

  if (digestResult && digestResult.mensagem_telegram) {
    msg = digestResult.mensagem_telegram;
    recomendacao = digestResult.recomendacao || recomendacao;
  }

  return {
    mensagem_telegram: msg,
    recomendacao,
    dados_brutos: { totalLikes, totalComments, totalShares, totalReach, engagement, platformStats }
  };
}

// ─── APROVAR INPUT ÚNICO ───

async function approveSingleInput(suggestionId, chatId) {
  const sug = queryOne('SELECT * FROM suggestions WHERE id = ?', [suggestionId]);
  if (!sug) return { success: false, message: 'Sugestão não encontrada.' };

  const data = JSON.parse(sug.content_generated || '{}');
  const now = Math.floor(Date.now() / 1000);
  const postId = uuidv4();

  const copyFinal = data.squad4?.copy_final || data.squad3?.copy || sug.description || '';
  const hashtags = data.squad3?.hashtags || [];
  const media = data.media || null;

  // Criar post
  runSql(
    `INSERT INTO posts (id, title, description, platform, stage, assigned_to, content, hashtags, scheduled_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [postId, sug.title, copyFinal.substring(0, 300),
     data.plataforma || sug.platform || 'instagram',
     'publicar', 'Gabi Publica',
     JSON.stringify({ copy: copyFinal, media, squad3: data.squad3, squad4: data.squad4 }),
     JSON.stringify(hashtags), '', now, now]
  );

  runSql('UPDATE suggestions SET status = ?, post_id = ?, updated_at = ? WHERE id = ?',
    ['approved', postId, now, suggestionId]);

  activeSingleInput = null;

  // Executar Squad5
  try {
    const squad5Input = {
      post_id: postId,
      plataforma: data.plataforma || sug.platform || 'instagram',
      tipo: data.tipo || 'feed',
      copy: copyFinal,
      hashtags,
      media
    };
    executeSquad(5, squad5Input, getBrandContext()).then(squad5Result => {
      runSql(
        'INSERT INTO scheduled_publishes (id, post_id, platform, scheduled_date, status, published_at) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), postId, data.plataforma || sug.platform || 'instagram',
         new Date().toISOString().split('T')[0], squad5Result?.status || 'pending', now]
      );

      // Squad6 após 24h
      setTimeout(async () => {
        try {
          const digest = await generateMetricsDigest();
          if (digest?.mensagem_telegram && chatId && notifyCallback) {
            notifyCallback(chatId, digest.mensagem_telegram);
          }
        } catch (e) {
          console.error('[Squad6] Erro:', e.message);
        }
      }, 24 * 60 * 60 * 1000);
    });
  } catch (err) {
    console.error('[Squad5] Erro:', err.message);
  }

  const hasMedia = media?.images?.length > 0;
  let msg = `✅ Conteúdo aprovado!\n📌 ${sug.title}\n📱 ${capitalize(data.plataforma || sug.platform || '')}\n`;
  if (hasMedia) msg += `🖼️ ${media.images.length} mídia(s) gerada(s)\n`;
  msg += `📄 ID: ${postId.substring(0, 8)}...\n`;
  msg += `\n⚠️ Publicação simulada: nenhuma API de rede social configurada.\n`;
  msg += `📊 Métricas em 24h via Squad6.\n`;
  msg += `📋 /post ${postId.substring(0, 8)} — Ver detalhes\n`;
  return { success: true, message: msg, postId };
}

async function rejectSingleInput(suggestionId) {
  const now = Math.floor(Date.now() / 1000);
  runSql("UPDATE suggestions SET status = 'rejected', updated_at = ? WHERE id = ?", [now, suggestionId]);
  activeSingleInput = null;
  return { success: true, message: '❌ Conteúdo rejeitado.' };
}

module.exports = {
  startWeeklyCycle, approveCycle, adjustPost, rejectCycle,
  getActiveCycle, getStatusSummary, generateMetricsDigest,
  processSingleInput, approveSingleInput, rejectSingleInput,
  setNotifyCallback, setPaused, isCyclePaused, generateRealMedia
};
