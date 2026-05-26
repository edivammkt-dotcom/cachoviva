const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const SA_PATH = path.join(__dirname, '..', 'cachoviva-sa.json');
const REGION = 'us-central1';
const PROJECT_ID = 'grand-fx-483721-m5';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

const TEXT_MODELS = [
  config.gemini.textModel,
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash'
].filter(Boolean);

const GEMINI_IMAGE_MODELS = [
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-exp-image-generation',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
];

const VERTEX_GEMINI_IMAGE_MODELS = [
  'gemini-2.0-flash-001',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
];

const IMAGEN_MODELS = [
  'imagen-3.0-generate-001',
  'imagen-3.0-fast-generate-001',
  'imagegeneration@002',
  'imagen-2.0-generate-001',
];

let cachedToken = null;
let tokenExpiry = 0;

function getServiceAccount() {
  const raw = fs.readFileSync(SA_PATH, 'utf8');
  return JSON.parse(raw);
}

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  const sa = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const signedJwt = jwt.sign(payload, sa.private_key, { algorithm: 'RS256' });

  const resp = await axios.post('https://oauth2.googleapis.com/token',
    `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedJwt}`,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
  );

  cachedToken = resp.data.access_token;
  tokenExpiry = Date.now() + (resp.data.expires_in || 3600) * 1000;
  return cachedToken;
}

function buildUrl(modelName) {
  return `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/${modelName}:generateContent`;
}

async function callVertex(prompt, systemPrompt = '', modelName = TEXT_MODELS[0], retries = 1) {
  const modelsToTry = [...new Set([modelName, ...TEXT_MODELS])];

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const token = await getAccessToken();
        const url = buildUrl(model);

        const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
        if (systemPrompt) {
          body.system_instruction = { parts: [{ text: systemPrompt }] };
        }

        const resp = await axios.post(url, body, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          timeout: 90000,
        });

        const candidate = resp.data?.candidates?.[0];
        if (!candidate) {
          console.warn(`[VertexAI] Sem candidatos no ${model}`);
          continue;
        }

        if (candidate.finishReason && !['STOP', 'MAX_TOKENS'].includes(candidate.finishReason)) {
          console.warn(`[VertexAI] ${model} bloqueado: ${candidate.finishReason}`);
          continue;
        }

        const text = candidate.content?.parts?.map(p => p.text).filter(Boolean).join('\n');
        if (!text || text.trim().length === 0) continue;

        console.log(`[VertexAI] ${model} OK (${text.length} chars)`);
        return text;
      } catch (err) {
        const msg = err.message || '';
        const status = err.response?.status;
        const isQuota = status === 429 || msg.includes('quota') || msg.includes('Quota');
        const isNotFound = status === 404 || msg.includes('not found') || msg.includes('notFound');
        const isAuth = status === 403 || status === 401;

        if (isAuth) {
          console.error(`[VertexAI] Erro de autenticação: ${msg.substring(0, 100)}`);
          cachedToken = null;
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }
          return null;
        }
        if (isNotFound) {
          console.log(`[VertexAI] Modelo ${model} nao disponivel`);
          break;
        }
        if (isQuota && attempt < retries) {
          console.log(`[VertexAI] Quota ${model}, tentativa ${attempt + 1}...`);
          await new Promise(r => setTimeout(r, 10000));
          continue;
        }
        if (isQuota) {
          console.log(`[VertexAI] Quota excedida em ${model}, proximo...`);
          continue;
        }
        console.warn(`[VertexAI] Erro ${model}: ${msg.substring(0, 100)}`);
        return null;
      }
    }
  }
  console.warn('[VertexAI] Todos os modelos falharam');
  return null;
}

async function generateText(prompt, systemPrompt = '') {
  return callVertex(prompt, systemPrompt);
}

function extractImagesFromGeminiResponse(data) {
  const candidate = data?.candidates?.[0];
  if (!candidate) return null;
  const parts = [];
  for (const part of candidate.content?.parts || []) {
    if (part.inlineData?.mimeType?.startsWith('image/')) {
      parts.push({
        imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        mimeType: part.inlineData.mimeType,
        data: part.inlineData.data,
        revisedPrompt: candidate.content?.parts?.[0]?.text || '',
      });
    }
  }
  return parts.length > 0 ? parts : null;
}

async function generateImage(prompt, options = {}) {
  const token = await getAccessToken();

  // 1. Vertex AI Gemini generateContent (mais provavel de funcionar)
  for (const model of VERTEX_GEMINI_IMAGE_MODELS) {
    try {
      const url = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/${model}:generateContent`;
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['Text', 'Image'] },
      };

      const resp = await axios.post(url, body, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 60000,
      });

      const images = extractImagesFromGeminiResponse(resp.data);
      if (images) {
        console.log(`[VertexAI] Gemini ${model}: ${images.length} imagem(ns)`);
        return images;
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || '';
      const status = err.response?.status;
      if (status === 404 || msg.includes('not found')) {
        console.log(`[VertexAI] Gemini ${model} nao suporta imagem`);
      } else {
        console.warn(`[VertexAI] Gemini ${model} (${status}): ${msg.substring(0, 120)}`);
      }
    }
  }

  // 2. Vertex AI Imagen predict
  for (const model of IMAGEN_MODELS) {
    try {
      const url = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/${model}:predict`;
      const body = {
        instances: [{ prompt }],
        parameters: {
          sampleCount: options.sampleCount || 2,
          aspectRatio: options.aspectRatio || '1:1',
          safetySettings: { safetyFilterLevel: 'block_some', personGeneration: 'allow_adult' },
        },
      };

      const resp = await axios.post(url, body, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 90000,
      });

      const predictions = resp.data?.predictions || [];
      if (predictions.length === 0) continue;

      const images = predictions.map(p => {
        const data = p.bytesBase64Encoded || p.bytesBase64 || p.image?.bytesBase64Encoded || '';
        return {
          imageUrl: `data:${p.mimeType || 'image/png'};base64,${data}`,
          mimeType: p.mimeType || 'image/png',
          data,
          revisedPrompt: prompt,
        };
      });

      console.log(`[VertexAI] Imagen ${model}: ${images.length} imagem(ns)`);
      return images;
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || '';
      const status = err.response?.status;
      console.warn(`[VertexAI] Imagen ${model} (${status}): ${msg.substring(0, 120)}`);
    }
  }

  // 3. Gemini API key fallback
  const apiKey = config.gemini.apiKey;
  if (apiKey && !apiKey.startsWith('sua-')) {
    for (const model of GEMINI_IMAGE_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const resp = await axios.post(url, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['Text', 'Image'] },
        }, { timeout: 30000 });

        const images = extractImagesFromGeminiResponse(resp.data);
        if (images) {
          console.log(`[GeminiAPI] ${model}: ${images.length} imagem(ns)`);
          return images;
        }
      } catch (err) {
        const msg = err.response?.data?.error?.message || err.message || '';
        console.warn(`[GeminiAPI] ${model}: ${msg.substring(0, 120)}`);
      }
    }
  }

  return null;
}

const VEO_MODELS = [
  'veo-3.1-generate-preview',
  'veo-3.1-fast-generate-preview',
];

async function generateVideo(prompt, options = {}) {
  const token = await getAccessToken();
  if (!token) {
    console.warn('[VertexAI-Veo] Sem token de acesso');
    return null;
  }

  for (const model of VEO_MODELS) {
    try {
      const baseUrl = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/${model}`;
      const url = `${baseUrl}:predictLongRunning`;

      const body = {
        instances: [{ prompt }],
        parameters: {
          aspectRatio: options.aspectRatio || '9:16',
          ...(options.durationSeconds ? { durationSeconds: options.durationSeconds } : {}),
          sampleCount: 1,
        },
      };

      console.log(`[VertexAI-Veo] ${model} iniciando...`);
      const resp = await axios.post(url, body, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      });

      const opName = resp.data?.name;
      if (!opName) {
        console.log(`[VertexAI-Veo] ${model} sem operation name`);
        continue;
      }

      console.log(`[VertexAI-Veo] ${model} operação: ${opName}`);
      const videos = await pollVeoOperation(model, opName, token);
      if (videos && videos.length > 0) {
        console.log(`[VertexAI-Veo] ${model} ✅ ${videos.length} vídeo(s)`);
        return videos;
      }
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error?.message || err.message || '';
      if (status === 404 || msg.includes('not found')) {
        console.log(`[VertexAI-Veo] ${model} não disponível`);
        continue;
      }
      console.warn(`[VertexAI-Veo] ${model} erro (${status}): ${msg.substring(0, 200)}`);
    }
  }
  return null;
}

async function pollVeoOperation(model, opName, token, maxAttempts = 90) {
  const baseUrl = `https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/${model}`;
  const pollUrl = `${baseUrl}:fetchPredictOperation`;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const { data } = await axios.post(pollUrl,
        { operationName: opName },
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      if (data.done) {
        if (data.error) {
          console.warn(`[VertexAI-Veo] Operação falhou: ${data.error.message}`);
          return null;
        }
        const samples = data.response?.generateVideoResponse?.generatedSamples || [];
        const videos = samples.map(s => ({
          videoUrl: s.video?.uri || '',
          mimeType: s.video?.mimeType || 'video/mp4',
        })).filter(v => v.videoUrl);
        return videos.length > 0 ? videos : null;
      }
      if (i % 15 === 14) console.log(`[VertexAI-Veo] ${(i+1)*2}s aguardando...`);
    } catch (pollErr) {
      const status = pollErr.response?.status;
      const msg = pollErr.response?.data?.error?.message || pollErr.message || '';
      if (i === 0 || i % 10 === 9) console.log(`[VertexAI-Veo] Poll #${i} (${status}): ${msg.substring(0, 100)}`);
    }
  }
  console.warn('[VertexAI-Veo] Timeout');
  return null;
}

module.exports = { generateText, generateImage, generateVideo, callVertex, getAccessToken };
