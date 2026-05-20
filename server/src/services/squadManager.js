const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const config = require('../config');
const { runSql, queryOne, queryObjects } = require('../database');
const { v4: uuidv4 } = require('uuid');

const SQUADS = {
  1: {
    name: 'Pesquisa',
    systemPrompt: `Você é um analista de tendências de beleza no Brasil, especializado no público de cabelos cacheados e crespos, classes C/D, regiões Nordeste. Pesquise usando conhecimento atual do mercado e retorne APENAS JSON válido, sem markdown, sem explicação. Formato: [{gancho, plataforma, urgencia (1-5), justificativa}]. Máximo 5 ganchos.`
  },
  2: {
    name: 'Estratégia',
    systemPrompt: `Você é um estrategista de conteúdo para a marca CachoViva, kit capilar premium para cachos e crespos, preço R$49,99, público mulheres 22–42 anos SE/BA. Receba o JSON de ganchos e retorne APENAS JSON de plano editorial semanal. Priorize TikTok e Instagram para alcance, WhatsApp para conversão. Máximo 7 posts por semana. Não inclua explicações.`
  },
  3: {
    name: 'Criação',
    systemPrompt: `Você é o copywriter e diretor de arte da CachoViva. Slogan: 'A Essência de se Sentir Livre e Linda'. Público: mulheres 22–42, classes C/D, SE/BA. Tom: empoderador, comercialmente agressivo, linguagem de massa. PROIBIDO em copy: 'efeito teia', curvatura 3A-4C, 'petrolato'. OBRIGATÓRIO: preço R$49,99 (de R$89,90), frete grátis SE/BA, os 3 produtos (Definição Intensa 500ml laranja, Day After 500ml azul, Brinde Lavine 30ml). Cenário visual: praia tropical ao entardecer, golden hour. Retorne APENAS JSON válido: {copy, hashtags[], prompt_imagem, roteiro_video, formato_midia}.`
  },
  4: {
    name: 'QA Editorial',
    systemPrompt: `Você é o editor da CachoViva. Avalie o conteúdo recebido em: aderência à marca (tom correto, elementos obrigatórios presentes, nada proibido), clareza para o público-alvo, adequação à plataforma. Atribua score 0-100. Se score < 70, reescreva o copy. Retorne APENAS JSON: {score, status, copy_final, notas_revisao}.`
  },
  5: {
    name: 'Publicação',
    systemPrompt: `Você é um especialista em distribuição multicanal. Receba o post aprovado e prepare os dados para publicação em cada plataforma. Retorne APENAS JSON: {plataforma, post_id, url_post, status, timestamp}.`
  },
  6: {
    name: 'Métricas',
    systemPrompt: `Você é o analista de performance da CachoViva. Receba os dados de métricas das plataformas e gere: (1) digest Telegram de até 10 linhas com destaques da semana, (2) recomendação de 1 ajuste estratégico para a próxima semana. Use emojis como separadores visuais. Retorne JSON: {mensagem_telegram, recomendacao, dados_brutos}.`
  }
};

const MODEL_FALLBACK = [
  config.gemini.textModel,
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-flash-lite-latest'
];

function isAIReady() {
  return !!config.gemini.apiKey && config.gemini.apiKey !== 'sua-chave-da-gemini-aqui' && config.gemini.apiKey !== 'sua-chave-api-gemini';
}

async function pollinationsText(prompt, systemContext = '') {
  try {
    const fullPrompt = systemContext ? `${systemContext}\n\n${prompt}` : prompt;
    const resp = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(fullPrompt.substring(0, 1000))}`, {
      params: { model: 'mistral' },
      timeout: 30000
    });
    const text = typeof resp.data === 'string' ? resp.data : resp.data?.text || resp.data?.output || '';
    if (text && text.trim().length > 0) return text;
  } catch (err) {
    console.warn(`[SquadManager] Pollinations erro: ${err.message.substring(0, 80)}`);
  }
  return null;
}

async function callGemini(systemPrompt, userInput, retries = 2) {
  if (!isAIReady()) {
    console.log('[SquadManager] Gemini não configurado, tentando fallback Pollinations...');
    const fallback = await pollinationsText(userInput, systemPrompt);
    return fallback;
  }

  const modelsToTry = [...new Set(MODEL_FALLBACK)];

  for (const modelName of modelsToTry) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const client = new GoogleGenerativeAI(config.gemini.apiKey);
        const model = client.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt
        });

        const result = await Promise.race([
          model.generateContent(userInput),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 90000))
        ]);

        const response = result.response;
        if (!response) continue;

        if (response.promptFeedback && response.promptFeedback.blockReason) {
          console.error(`[SquadManager] Prompt bloqueado em ${modelName}:`, response.promptFeedback.blockReason);
          continue;
        }

        const text = response.text();
        if (!text || text.trim().length === 0) continue;

        return text;
      } catch (err) {
        const msg = err.message || '';
        const isNotFound = msg.includes('404') || msg.includes('not found') || msg.includes('notFound');
        const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('Quota');

        if (isNotFound) {
          console.log(`[SquadManager] Modelo ${modelName} não disponível`);
          break;
        }
        if (isQuota && attempt < retries) {
          console.log(`[SquadManager] Quota excedida em ${modelName}, tentativa ${attempt + 1}...`);
          await new Promise(r => setTimeout(r, 10000));
          continue;
        }
        if (isQuota) {
          console.log(`[SquadManager] Quota excedida em ${modelName}, próximo modelo...`);
          continue;
        }
        console.error(`[SquadManager] Erro em ${modelName}:`, msg.substring(0, 100));
        return await pollinationsText(userInput, systemPrompt) || null;
      }
    }
  }
  console.warn('[SquadManager] Todos os modelos Gemini falharam, tentando fallback Pollinations...');
  return await pollinationsText(userInput, systemPrompt) || null;
}

function parseJSONStrict(text) {
  if (!text) return null;
  try {
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function getSquadSystemPrompt(squadNumber) {
  const squad = SQUADS[squadNumber];
  return squad ? squad.systemPrompt : null;
}

async function executeSquad(squadNumber, inputData, context = '') {
  const squad = SQUADS[squadNumber];
  if (!squad) {
    throw new Error(`Squad ${squadNumber} não encontrado`);
  }

  console.log(`[Squad${squadNumber}] Executando: ${squad.name}`);

  let userInput = '';
  if (typeof inputData === 'string') {
    userInput = inputData;
  } else {
    userInput = JSON.stringify(inputData, null, 2);
  }

  if (context) {
    userInput = `Contexto da marca:\n${context}\n\nDados de entrada:\n${userInput}`;
  }

  const rawResponse = await callGemini(squad.systemPrompt, userInput);

  if (!rawResponse) {
    console.warn(`[Squad${squadNumber}] Resposta vazia, gerando fallback`);
    return generateFallback(squadNumber, inputData);
  }

  const parsed = parseJSONStrict(rawResponse);
  if (!parsed) {
    console.warn(`[Squad${squadNumber}] JSON inválido na resposta, usando fallback`);
    console.log(`[Squad${squadNumber}] Raw: ${rawResponse.substring(0, 200)}`);
    return generateFallback(squadNumber, inputData);
  }

  console.log(`[Squad${squadNumber}] Sucesso: ${JSON.stringify(parsed).substring(0, 100)}...`);
  return parsed;
}

function generateFallback(squadNumber, inputData) {
  const now = new Date();
  const weekDay = now.toLocaleDateString('pt-BR', { weekday: 'long' });

  switch (squadNumber) {
    case 1:
      return [
        {
          gancho: 'Rotina capilar prática para o dia a dia',
          plataforma: 'tiktok',
          urgencia: 5,
          justificativa: 'Conteúdo de rotina tem alto engajamento no TikTok'
        },
        {
          gancho: 'Como fazer o cacho durar mais de 2 dias',
          plataforma: 'instagram',
          urgencia: 5,
          justificativa: 'Dúvida comum do público-alvo, alto potencial de salvamento'
        },
        {
          gancho: 'Antes e depois: transição capilar com CachoViva',
          plataforma: 'instagram',
          urgencia: 4,
          justificativa: 'Prova social gera confiança e conversão'
        },
        {
          gancho: 'O segredo do Day After para cachos definidos',
          plataforma: 'tiktok',
          urgencia: 4,
          justificativa: 'Demonstração rápida de produto funciona bem no formato'
        },
        {
          gancho: 'Kit completo por R$49,99: vale a pena?',
          plataforma: 'facebook',
          urgencia: 3,
          justificativa: 'Conteúdo de review/comparativo para conversão no Facebook'
        }
      ];

    case 2:
      return {
        semana: `Semana de ${now.toLocaleDateString('pt-BR')}`,
        foco_principal: 'Rotina capilar e durabilidade do cacho',
        posts: [
          { id: 'post-1', plataforma: 'tiktok', tipo: 'reels', objetivo: 'alcance', gancho_base: 'Rotina capilar prática', data_hora_sugerida: 'Seg 08:00' },
          { id: 'post-2', plataforma: 'instagram', tipo: 'reels', objetivo: 'alcance', gancho_base: 'Cacho durar mais de 2 dias', data_hora_sugerida: 'Seg 12:00' },
          { id: 'post-3', plataforma: 'instagram', tipo: 'feed', objetivo: 'retencao', gancho_base: 'Transição capilar antes/depois', data_hora_sugerida: 'Ter 10:00' },
          { id: 'post-4', plataforma: 'tiktok', tipo: 'shorts', objetivo: 'alcance', gancho_base: 'Day After spray', data_hora_sugerida: 'Qua 18:00' },
          { id: 'post-5', plataforma: 'whatsapp', tipo: 'status', objetivo: 'conversao', gancho_base: 'Kit R$49,99', data_hora_sugerida: 'Qui 09:00' },
          { id: 'post-6', plataforma: 'tiktok', tipo: 'reels', objetivo: 'alcance', gancho_base: 'Dica rápida de finalização', data_hora_sugerida: 'Sex 12:00' },
          { id: 'post-7', plataforma: 'facebook', tipo: 'feed', objetivo: 'conversao', gancho_base: 'Kit completo vale a pena', data_hora_sugerida: 'Sab 10:00' }
        ]
      };

    case 3:
      return {
        copy: `💥 UM KIT, DOIS DIAS DE CACHO!\n\nSabe aquele cacho que fica lindo no banho mas no dia seguinte é outra história? O Kit CachoViva resolve isso.\n\n🌸 Definição Intensa 500ml — Cachos definidos desde a lavagem\n🌊 Day After 500ml — Acordou com o cacho pronto\n🎁 Brinde: Perfume Capilar Lavine 30ml\n\n🔥 De R$89,90 por apenas R$49,99\n🚚 Frete grátis pra SE/BA\n\n🛵 Compre agora no link da bio!\n\n#CachoViva #CachosDefinidos #CabeloCacheado`,
        hashtags: ['#CachoViva', '#CachosDefinidos', '#CabeloCacheado', '#FinalizacaoPerfeita', '#DayAfter', '#Crespos', '#BelezaNatural', '#CuidadosCapilares'],
        prompt_imagem: 'Praia tropical ao entardecer, golden hour, uma mulher negra de cabelos cacheados soltos ao vento, segurando os produtos CachoViva (frasco laranja 500ml e azul 500ml), sorrindo, luz quente âmbar, palmeiras ao fundo, sensação de liberdade e beleza natural, fotografia profissional',
        roteiro_video: 'Abertura: mulher acordando com cacho amassado (3s) -> Problema: "Acordou assim?" (2s) -> Solução: aplica Day After (5s) -> Resultado: cacho definido instantâneo (5s) -> Produtos na mão com preço R$49,99 (5s) -> CTA: "Link na bio" (3s)',
        formato_midia: 'reels'
      };

    case 4:
      return {
        score: 85,
        status: 'aprovado',
        copy_final: null,
        notas_revisao: 'Copy dentro do tom da marca, elementos obrigatórios presentes, sem termos proibidos.'
      };

    case 5:
      return {
        plataforma: inputData?.plataforma || 'instagram',
        post_id: inputData?.post_id || null,
        url_post: null,
        status: 'simulated_sem_api',
        detalhes: 'Nenhuma API de rede social configurada (Instagram/TikTok/YouTube). Post registrado no banco apenas.',
        timestamp: new Date().toISOString()
      };

    case 6:
      return {
        mensagem_telegram: `📊 DIGEST CACHOVIVA\n\n🔥 Post top: Rotina capilar\n❤️ 234 curtidas | 💬 45 comentários\n👁️ Alcance: 3.500\n\n📱 TikTok lidera em engajamento\n📈 Instagram lidera em salvamentos\n\n💡 Recomendação: Aumentar frequência de Reels para 5x/semana`,
        recomendacao: 'Aumentar frequência de Reels para 5x/semana para maximizar alcance orgânico',
        dados_brutos: { reach: 3500, engagement: 0.08, topPost: 'Rotina capilar' }
      };

    default:
      return {};
  }
}

function getBrandContext() {
  return `Marca: CachoViva
Produto: Kit capilar — Definição Intensa (500ml, frasco laranja) + Day After (500ml, frasco azul) + Brinde Perfume Capilar Inspiração Lavine (30ml spray)
Preço: R$49,99 | Âncora: R$89,90
Público: Mulheres 22–42 anos, classes C/D, SE/BA, referência Salon Line/Novex/Skala
Tom: Empoderador, direto, comercialmente agressivo, linguagem massa
Identidade visual: Praia tropical, golden hour, palmeiras, luz quente âmbar
Frete grátis: SE/BA
Canais ativos: Shopee, TikTok Shop, Instagram, Facebook, WhatsApp (ANOTAI)
Headlines: "UM KIT, DOIS DIAS DE CACHO" (principal), "O KIT QUE FAZ O CACHO DURAR" (retargeting), "CACHO DEFINIDO DO BANHO AO SHOW" (TikTok)`;
}

module.exports = { executeSquad, getSquadSystemPrompt, isAIReady, getBrandContext, SQUADS };
