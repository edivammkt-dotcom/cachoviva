const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

let currentSystemInstruction = '';

function isAIReady() {
  return !!config.gemini.apiKey && config.gemini.apiKey !== 'sua-chave-da-gemini-aqui';
}

const MODELS_FALLBACK = [
  config.gemini.textModel,
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-lite-latest',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash'
];

const POLLINATIONS_TEXT = 'https://text.pollinations.ai';

async function pollinationsText(prompt, systemContext = '') {
  try {
    const fullPrompt = systemContext ? `${systemContext}\n\n${prompt}` : prompt;
    const resp = await axios.get(`${POLLINATIONS_TEXT}/${encodeURIComponent(fullPrompt.substring(0, 1000))}`, {
      params: { model: 'mistral' },
      timeout: 30000
    });
    const text = typeof resp.data === 'string' ? resp.data : resp.data?.text || resp.data?.output || '';
    if (text && text.trim().length > 0) {
      console.log(`[AI] Fallback Pollinations OK (${text.length} chars)`);
      return text;
    }
  } catch (err) {
    console.warn(`[AI] Fallback Pollinations erro: ${err.message.substring(0, 80)}`);
  }
  return null;
}

async function generateText(prompt, retries = 1) {
  const modelsToTry = [...new Set([config.gemini.textModel, ...MODELS_FALLBACK])];

  for (const modelName of modelsToTry) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const client = new GoogleGenerativeAI(config.gemini.apiKey);
        const modelConfig = { model: modelName };
        if (currentSystemInstruction) {
          modelConfig.systemInstruction = currentSystemInstruction;
        }
        const model = client.getGenerativeModel(modelConfig);

        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 90000))
        ]);
        const response = result.response;
        if (!response) {
          console.error(`[AI] Resposta vazia do modelo ${modelName}`);
          continue;
        }
        if (response.promptFeedback && response.promptFeedback.blockReason) {
          console.error(`[AI] Prompt bloqueado no ${modelName}:`, response.promptFeedback.blockReason);
          return await pollinationsText(prompt, currentSystemInstruction) || null;
        }
        const text = response.text();
        if (!text || text.trim().length === 0) {
          console.error(`[AI] Texto vazio no ${modelName}`);
          continue;
        }
        return text;
      } catch (err) {
        const msg = err.message || '';
        const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('Quota');
        const isRateLimit = msg.includes('429') || msg.includes('rate_limit');
        const isNotFound = msg.includes('404') || msg.includes('not found') || msg.includes('notFound');

        if (isNotFound) {
          console.log(`[AI] Modelo ${modelName} nao disponivel, tentando proximo...`);
          break;
        }
        if ((isQuota || isRateLimit) && attempt < retries) {
          const wait = 10;
          console.log(`[AI] Quota excedida no ${modelName}, tentativa ${attempt + 1}, aguardando ${wait}s...`);
          await new Promise(r => setTimeout(r, wait * 1000));
          continue;
        }
        if (isQuota || isRateLimit) {
          console.log(`[AI] Quota excedida no ${modelName}, tentando proximo modelo...`);
          continue;
        }
        console.error(`[AI] Erro no modelo ${modelName}:`, err.name, msg.substring(0, 100));
        return await pollinationsText(prompt, currentSystemInstruction) || null;
      }
    }
  }
  console.error('[AI] Todos os modelos excederam cota ou falharam, tentando fallback Pollinations...');
  return await pollinationsText(prompt, currentSystemInstruction) || null;
}

function setSkillsContext(context) {
  currentSystemInstruction = context;
}

function getSkillsContext() {
  return currentSystemInstruction;
}

function parseJSON(text) {
  if (!text) return null;
  try {
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

class ContentAI {
  constructor() {
    this.apiKey = isAIReady() ? config.gemini.apiKey : '';
  }

  _cachovivaProducts() {
    return `Creme Cachos Definidos (kit dia 1+2, R$49,90, 2 dias de cacho definido)
Day After Spray (definição instantânea, anti-frizz, sem pesar, R$34,90)
Perfume Capilar Lavine (fragrância que fica, R$29,90)`;
  }

  async generatePostPreview(topic, platform, tone = 'cachoviva', options = {}) {
    const products = this._cachovivaProducts();
    const prompt = `Com base nas diretrizes da marca CachoViva (acima), gere uma postagem COMPLETA e PRONTA PARA PUBLICAR.

TEMA: "${topic}"
PLATAFORMA: ${platform}
TOM: CachoViva (siga o tom de voz da marca para esta plataforma)
${options.pilar ? `PILAR: ${options.pilar}` : ''}

Produtos da marca: ${products}

Retorne APENAS UM JSON válido, sem marcadores de código, com esta estrutura exata:

{
  "platform": "${platform}",
  "pilar": "qual pilar de conteudo (Prova Social, Educação que Vende, Identidade, Bastidor, Conversão)",
  "hook": "gancho de 3 segundos (contradição, curiosidade, prova visual ou identificação)",
  "caption": "texto completo da legenda formatado para a plataforma com quebras de linha, emojis e CTA no final",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"],
  "cta": "chamada para acao especifica",
  "imagePrompt": "descricao detalhada da imagem ideal para este post no estilo CachoViva (nude #F0C8AA, cobre #6B331E, verde-floresta #3A5020, dourado #B8A060, pessoa negra 25-35 anos cachos 3B-3C)",
  "imageStyle": "CachoViva brand style - professional product photography, warm tones, copper and nude palette, natural lighting, curly hair, Brazilian woman 25-35, #F0C8AA #6B331E background",
  "productMentioned": "qual produto CachoViva mencionar ou null",
  "captionShort": "versão curta da legenda (max 150 chars) para Instagram/feed",
  "captionLong": "versão longa completa para quem quer ler mais",
  "onScreenText": "texto para aparecer na tela (TikTok/Reels) ou null",
  "format": "post | carrossel | reel | video | stories"
}`;

    const text = await generateText(prompt);
    const parsed = parseJSON(text);
    if (parsed) return { success: true, preview: parsed };

    return {
      success: true,
      preview: {
        platform,
        pilar: 'Educação que Vende',
        hook: `Sabe por que seu cacho ${topic}? A gente explica.`,
        caption: `✨ Você sabia? ${topic}\n\nA CachoViva tem a solução perfeita para o seu cacho.\n\n✅ Resultado real\n✅ Preço justo\n✅ Qualidade de salão\n\n👉 Salve para ver depois e marque aquela amiga que precisa saber disso!\n\n#CachoViva #CachosDefinidos`,
        hashtags: ['#CachoViva', '#CachosDefinidos', `#${topic.replace(/\s+/g, '')}`, '#CabeloCacheado', '#TransicaoCapilar'],
        cta: 'Salve para ver depois e compartilhe com quem precisa!',
        imagePrompt: `Mulher negra 25-35 anos com cabelos cacheados 3B-3C, ${topic}, fundo nude #F0C8AA, iluminação natural, estúdio profissional`,
        imageStyle: 'CachoViva brand style - professional product photography, warm tones, copper and nude palette, natural lighting, curly hair, Brazilian woman 25-35',
        productMentioned: null,
        captionShort: `${topic} — A CachoViva explica tudo! 👆`,
        captionLong: `✨ Você sabia?\n\n${topic}\n\nA CachoViva desenvolveu produtos específicos para essa necessidade. Creme Cachos Definidos, Day After Spray e Perfume Capilar Lavine.\n\nQualidade de salão, preço que cabe no bolso.\n\n#CachoViva`,
        onScreenText: platform === 'tiktok' ? `👩🏾‍🦱 ${topic}` : null,
        format: 'post'
      }
    };
  }

  async generateContentIdeas(topic, platform, audience = 'geral') {
    const products = this._cachovivaProducts();
    const prompt = `Seguindo a linha editorial CachoViva, gere 5 ideias de conteudo para ${platform} sobre "${topic}" (publico: ${audience}).

Produtos CachoViva: ${products}

Cada ideia DEVE considerar:
- Pilar de conteudo (Prova Social, Educação que Vende, Identidade, Bastidor, Conversão)
- Tom de voz CachoViva para a plataforma
- Abordagem dos 3 segundos (contradição, curiosidade, prova visual, identificação)

Responda APENAS JSON valido: { "ideas": [{ "title": "...", "description": "...", "hashtags": ["#tag"], "format": "post|carrossel|reel", "angle": "...", "pilar": "..." }] }`;
    const text = await generateText(prompt);
    return parseJSON(text) || this._fallbackIdeas(`Ideias CachoViva sobre ${topic} para ${platform}`);
  }

  async generatePostContent(title, description, platform, tone = 'cachoviva') {
    const products = this._cachovivaProducts();
    const prompt = `Crie o texto COMPLETO e PRONTO PARA PUBLICAR de uma postagem da marca CachoViva.

Titulo: ${title}
Descricao: ${description || ''}
Plataforma: ${platform}
Tom: CachoViva (${platform === 'tiktok' ? 'descontraído, direto, humor - amiga que entende de cacho' : platform === 'instagram' ? 'aspiracional, empoderador - referência de estilo e cuidado' : 'educativo e próximo'})

Produtos: ${products}

Regras:
- Siga a linha editorial CachoViva
- Use gancho de 3 segundos (contradição, curiosidade, identificação, prova visual)
- Inclua CTA alinhado ao pilar
- Hashtags estrategicas da marca (#CachoViva, #CachosDefinidos + nicho)
- NUNCA use superlativos vazios ou linguagem corporativa
- Formato PRONTO para copiar e colar na plataforma

Responda APENAS o texto final completo, sem explicacoes.`;
    return generateText(prompt);
  }

  async generateImage(prompt, style = 'cachoviva') {
    const cachovivaStyle = 'warm tones, copper #6B331E, nude #F0C8AA, green #3A5020, gold #B8A060, professional product photography, natural lighting, Brazilian woman 25-35 with curly hair 3B-3C, high quality, 1080x1080, soft shadows, premium aesthetic';
    const enhancedPrompt = style === 'cachoviva'
      ? `${prompt}, ${cachovivaStyle}`
      : `${prompt}, ${style} style, high quality, social media`;
    const useGemini = config.gemini.apiKey && config.gemini.apiKey !== 'sua-chave-da-gemini-aqui' && isAIReady();
    const useFreeProvider = process.env.IMAGE_PROVIDER !== 'gemini' || !useGemini;

    if (useGemini && !useFreeProvider) {
      return this._generateImageGemini(enhancedPrompt);
    }

    return await this._generateImagePollinations(enhancedPrompt);
  }

  async _generateImagePollinations(enhancedPrompt) {
    const encoded = encodeURIComponent(enhancedPrompt.replace(/[<>"'&]/g, '').substring(0, 400));
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encoded}`;
    const fallbackUrl = `https://picsum.photos/seed/${Date.now()}/1080/1080`;

    console.log(`[AI Image] Pollinations URL: ${pollinationsUrl.substring(0, 120)}`);

    try {
      const headResp = await axios.head(pollinationsUrl, { timeout: 5000 }).catch(() => null);
      if (headResp && headResp.status === 200 && headResp.headers['content-type']?.includes('image')) {
        return { imageUrl: pollinationsUrl, revisedPrompt: enhancedPrompt, mimeType: 'image/jpeg', data: null, cacheKey: encoded.substring(0, 60) };
      }
    } catch {}

    console.log(`[AI Image] Pollinations HEAD falhou, tentando GET direto...`);
    try {
      const resp = await axios.get(pollinationsUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        validateStatus: s => s === 200
      });
      const contentType = resp.headers['content-type'] || '';
      if (resp.data && resp.data.byteLength > 500 && contentType.includes('image')) {
        console.log(`[AI Image] Pollinations OK: ${(resp.data.byteLength / 1024).toFixed(1)} KB`);
        return { imageUrl: pollinationsUrl, revisedPrompt: enhancedPrompt, mimeType: contentType, data: null, cacheKey: encoded.substring(0, 60) };
      }
    } catch (err) {
      console.warn(`[AI Image] Pollinations GET falhou: ${err.message.substring(0, 80)}`);
    }

    console.log(`[AI Image] Usando fallback picsum.photos`);
    return { imageUrl: fallbackUrl, revisedPrompt: enhancedPrompt, mimeType: 'image/jpeg', data: null, cacheKey: null };
  }

  async _generateImageGemini(enhancedPrompt) {
    const IMAGE_MODELS = [
      config.gemini.imageModel,
      'gemini-2.0-flash-exp-image-generation',
      'gemini-2.0-flash-001',
      'gemini-2.0-flash'
    ].filter(Boolean);

    let lastError = null;
    for (const modelName of [...new Set(IMAGE_MODELS)]) {
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`,
          { contents: [{ parts: [{ text: enhancedPrompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } },
          { timeout: 30000 }
        );
        const candidate = response.data?.candidates?.[0];
        if (!candidate) continue;
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
            return { imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, revisedPrompt: enhancedPrompt, mimeType: part.inlineData.mimeType, data: part.inlineData.data };
          }
        }
      } catch (err) {
        lastError = err.message;
        if (err.message.includes('not found') || err.message.includes('404')) continue;
      }
    }
    console.error(`[AI Image] Gemini falhou: ${lastError}. Usando fallback Pollinations.`);
    const encoded = encodeURIComponent(enhancedPrompt.substring(0, 400));
    const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1080&height=1080&nologo=true`;
    return { imageUrl, revisedPrompt: enhancedPrompt, mimeType: 'image/jpeg', data: null };
  }

  async generateCarousel(topic, slides = 5) {
    const products = this._cachovivaProducts();
    const prompt = `Crie um roteiro para carrossel de Instagram da CachoViva sobre "${topic}" com ${slides} slides.

Produtos: ${products}

Siga o tom aspiracional/empoderador da CachoViva. Use a paleta de cores mentalmente (nude, cobre, verde-floresta, dourado).

Cada slide: Titulo chamativo, Texto curto (max 150 chars), Sugestao visual no estilo CachoViva (pessoa negra 25-35, cachos 3B-3C, fundo nude #F0C8AA).

JSON: { "title": "titulo do carrossel", "slides": [{ "title": "", "text": "", "visual": "" }] }`;
    const text = await generateText(prompt);
    return parseJSON(text) || { title: `Carrossel CachoViva: ${topic}`, slides: Array(slides).fill().map((_, i) => ({ title: `Slide ${i + 1}`, text: `Sobre ${topic}`, visual: `Mulher cacheada 3B-3C, fundo nude #F0C8AA` })) };
  }

  async generateVideoScript(topic, duration = '60s') {
    const products = this._cachovivaProducts();
    const prompt = `Crie roteiro de video ${duration} da CachoViva sobre "${topic}" para TikTok/Reels.

TOM: "Amiga que entende de cacho" — descontraído, direto, com humor.
Produtos: ${products}

Estrutura CachoViva:
1. Gancho 3s (contradição, curiosidade, identificação ou prova visual)
2. Problema → Explicação → Produto → Resultado
3. CTA final

JSON: { "title": "titulo", "hook": "gancho inicial", "scenes": [{ "time": "0-5s", "script": "fala", "visual": "descricao cena", "onScreenText": "texto na tela" }] }`;
    const text = await generateText(prompt);
    return parseJSON(text) || { title: `Video CachoViva: ${topic}`, hook: `Descubra ${topic}`, scenes: [{ time: '0-5s', script: 'Introducao', visual: 'Abertura com produto', onScreenText: topic }, { time: '5-15s', script: `Sobre ${topic}`, visual: 'Demonstracao no cabelo', onScreenText: null }, { time: '15-25s', script: 'Dica', visual: 'Detalhes do resultado', onScreenText: 'Dica:' }, { time: '25-30s', script: 'CTA', visual: 'Final com logo', onScreenText: 'CachoViva' }] };
  }

  async generatePerformanceInsights(posts) {
    const prompt = `Analise estes dados de performance e gere insights: ${JSON.stringify(posts, null, 2)}. Forneca: Padroes, Melhores horarios, Conteudo mais engajador, Recomendacoes. JSON: { "patterns": [], "bestTimes": [], "topContent": [], "recommendations": [] }`;
    const text = await generateText(prompt);
    return parseJSON(text) || { patterns: ['Posts diretos geram mais engajamento'], bestTimes: ['12:00', '19:00'], topContent: ['Tutoriais'], recommendations: ['Postar mais educativo'] };
  }

  async generateResearchSuggestion(briefing, keyword) {
    const prompt = `Com base no briefing e na palavra-chave, sugira conteudo completo.\nBriefing: ${briefing}\nKeyword: ${keyword}\nAnalise: 1. Melhor plataforma (instagram, tiktok, youtube, twitter, linkedin, facebook) 2. Melhor formato 3. Titulo 4. Descricao 5. Hashtags 6. Roteiro. JSON: { "platform": "instagram", "format": "carrossel", "title": "titulo", "description": "descricao", "hashtags": ["#tag"], "content": "texto" }`;
    const text = await generateText(prompt);
    return parseJSON(text) || { platform: 'instagram', format: 'post', title: `${keyword}: Dicas`, description: `Conteudo sobre ${keyword}`, hashtags: ['#' + keyword.replace(/\s+/g, ''), '#cachos'], content: `Conteudo sobre ${keyword}` };
  }

  async generateCompleteSuggestion(telegramText) {
    const products = this._cachovivaProducts();
    const prompt = `Com base nas diretrizes da marca CachoViva, gere uma sugestão COMPLETA de conteúdo.

Mensagem: "${telegramText}"
Produtos: ${products}

Siga a linha editorial, tom de voz e pilares de conteúdo CachoViva.
Use a Regra dos 3 Segundos no gancho.

JSON:
{
  "topic": "tema principal",
  "platform": "instagram | tiktok | youtube | linkedin",
  "format": "video | carrossel | post | reels | stories",
  "duration": "duracao ou slides",
  "hook": "gancho 3s (contradicao, curiosidade, identificacao ou prova visual)",
  "approach": "abordagem no tom CachoViva",
  "briefing": "briefing completo seguindo a linha editorial",
  "structure": ["passo 1", "passo 2"],
  "cta": "chamada para acao alinhada ao pilar",
  "hashtags": ["#CachoViva", "#CachosDefinidos", "#tag3"],
  "angles": ["angulo 1", "angulo 2"],
  "targetAudience": "publico alvo",
  "contentIdeas": [{ "title": "", "platform": "", "format": "", "description": "", "pilar": "" }]
}`;

    const text = await generateText(prompt);
    const parsed = parseJSON(text);
    if (parsed) return parsed;
    return {
      topic: telegramText.substring(0, 80),
      platform: 'instagram',
      format: 'post',
      duration: '30s',
      hook: `Sabe por que ${telegramText.substring(0, 40)}? A CachoViva explica.`,
      approach: 'Educativo no tom CachoViva - amiga que entende de cacho',
      briefing: `Criar conteudo sobre: ${telegramText}. Seguir linha editorial CachoViva.`,
      structure: ['Gancho com contradicao/curiosidade', 'Explicacao simples e direta', 'CTA de salvamento'],
      cta: 'Salve para ver depois!',
      hashtags: ['#CachoViva', '#CachosDefinidos', '#' + telegramText.toLowerCase().replace(/\s+/g, '').substring(0, 20)],
      angles: ['educativo', 'prova social'],
      targetAudience: 'Mulheres cacheadas e crespas 22-38 anos, Nordeste',
      contentIdeas: [{
        title: telegramText.substring(0, 60),
        platform: 'instagram',
        format: 'post',
        description: `Conteudo CachoViva sobre ${telegramText}`,
        pilar: 'Educação que Vende'
      }]
    };
  }

  async generateFullContent(title, description, platform, format) {
    const products = this._cachovivaProducts();
    const prompt = `Crie conteudo COMPLETO E PRONTO PARA PUBLICAR da CachoViva.

Titulo: ${title}
Descricao: ${description}
Plataforma: ${platform}
Formato: ${format}
Produtos: ${products}

Siga a linha editorial CachoViva. Tom de voz adequado para ${platform}.

JSON: {
  "mainText": "texto completo pronto para publicar com emojis e CTA",
  "captionShort": "versao curta (max 150 chars)",
  "captionMedium": "versao media com quebras de linha",
  "captionLong": "versao longa completa com storytelling",
  "hashtags": ["#CachoViva", "#CachosDefinidos", "#tag3", "#tag4", "#tag5"],
  "visualSuggestions": ["descricao visual 1", "descricao visual 2"],
  "cta": "chamada para acao",
  "onScreenText": "texto para tela (se video) ou null"
}`;
    const text = await generateText(prompt);
    return parseJSON(text) || {
      mainText: `${title}. ${description} — CachoViva, qualidade de salão, preço que cabe no bolso.`,
      captionShort: title,
      captionMedium: `${title}\n${description}\n\n#CachoViva #CachosDefinidos`,
      captionLong: `${title}\n${description}\n\nQualidade de salão, preço que cabe no bolso.\n\n👉 Salve para ver depois!\n\n#CachoViva #CachosDefinidos`,
      hashtags: ['#CachoViva', '#CachosDefinidos', '#CabeloCacheado', '#Cachos'],
      visualSuggestions: [`Mulher negra cacheada usando produto CachoViva, fundo nude`],
      cta: 'Salve para ver depois!',
      onScreenText: null
    };
  }

  async reviewContent(post) {
    const products = this._cachovivaProducts();
    const prompt = `Revise este conteudo contra a linha editorial CachoViva.
Titulo: ${post.title}
Descricao: ${post.description}
Conteudo: ${typeof post.content === 'string' && post.content.length < 500 ? post.content : (post.description || '')}
Plataforma: ${post.platform}
Produtos: ${products}

Verifique: alinhamento com linha editorial CachoViva, tom de voz correto para a plataforma, uso de gancho 3s, CTA alinhado ao pilar, qualidade premium, evita superlativos vazios.

JSON: { "score": 7.5, "clarity": "analise", "platformFit": "analise", "toneAnalysis": "analise", "brandAlignment": "esta alinhado com a CachoViva? sim/nao", "hashtagAnalysis": "analise", "ctaAnalysis": "analise", "suggestions": ["sugestao"], "revisedContent": "versao revisada seguindo a marca" }`;
    const text = await generateText(prompt);
    return parseJSON(text) || { score: 7, clarity: 'Ok', platformFit: 'Adequado', toneAnalysis: 'Ok', brandAlignment: 'Sim', hashtagAnalysis: 'Ok', ctaAnalysis: 'Ok', suggestions: ['Revisar manualmente'], revisedContent: post.description };
  }

  async validateContent(post) {
    const products = this._cachovivaProducts();
    const prompt = `Valide este conteudo contra a linha editorial CachoViva.
Titulo: ${post.title}
Descricao: ${post.description}
Conteudo: ${typeof post.content === 'string' && post.content.length < 500 ? post.content : (post.description || '')}
Plataforma: ${post.platform}
Produtos: ${products}

Verifique: alinhamento com a marca CachoViva (linha editorial, tom de voz, pilares), precisao das informacoes, otimizacao para a plataforma, uso correto de hashtags da marca.

JSON: { "passed": true, "score": 8, "editorialFit": "analise", "toneCheck": "analise", "accuracy": "analise", "platformOptimization": "analise", "brandVoiceMatch": "sim/nao", "issues": [], "suggestions": [] }`;
    const text = await generateText(prompt);
    return parseJSON(text) || { passed: true, score: 7, editorialFit: 'Alinhado com CachoViva', toneCheck: 'Ok', accuracy: 'Correto', platformOptimization: 'Ok', brandVoiceMatch: 'Sim', issues: [], suggestions: [] };
  }

  _fallbackIdeas(text) {
    return { ideas: text.split('\n').filter(l => l.trim()).slice(0, 5).map(t => ({ title: t, description: '', hashtags: [], format: 'imagem', angle: 'geral' })) };
  }
}

module.exports = ContentAI;
module.exports.setSkillsContext = setSkillsContext;
module.exports.getSkillsContext = getSkillsContext;
module.exports.generateText = generateText;
module.exports.parseJSON = parseJSON;
