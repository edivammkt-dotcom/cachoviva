const { generateVideo: vertexGenerateVideo } = require('./vertexAI');

const axios = require('axios');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const API_KEY = process.env.GEMINI_API_KEY;
const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;

const MODELS = [
  { name: 'veo-3.1-generate-preview', label: 'Veo 3.1' },
  { name: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast' },
];

async function generateVideo(prompt, options = {}) {
  // 1. Vertex AI (service account, PIX)
  console.log('[Veo] Tentando Vertex AI primeiro...');
  const vertexResult = await vertexGenerateVideo(prompt, options);
  if (vertexResult && vertexResult.length > 0) {
    console.log(`[Veo] Vertex AI ✅ ${vertexResult.length} vídeo(s)`);
    return vertexResult;
  }
  console.log('[Veo] Vertex AI falhou, tentando Gemini API...');

  // 2. Fallback: Gemini API (chave AIza)
  if (API_KEY) {
    for (const model of MODELS) {
      try {
        const url = `${GEMINI_BASE_URL}/models/${model.name}:predictLongRunning`;

        const body = {
          instances: [{ prompt }],
          parameters: {
            aspectRatio: options.aspectRatio || '9:16',
            ...(options.durationSeconds ? { durationSeconds: options.durationSeconds } : {}),
            sampleCount: 1,
          },
        };

        console.log(`[Veo] ${model.label} iniciando via Gemini API...`);
        const resp = await axios.post(url, body, {
          headers: { 'x-goog-api-key': API_KEY, 'Content-Type': 'application/json' },
          timeout: 30000,
        });

        const opName = resp.data?.name;
        if (!opName) {
          console.log(`[Veo] ${model.label} sem operation name`);
          continue;
        }

        console.log(`[Veo] ${model.label} operação: ${opName}`);
        const videos = await pollGeminiOperation(opName);
        if (videos && videos.length > 0) {
          console.log(`[Veo] ${model.label} ✅ ${videos.length} vídeo(s)`);
          return videos;
        }
      } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.error?.message || err.message || '';
        if (status === 404 || msg.includes('not found')) {
          console.log(`[Veo] ${model.label} não disponível`);
          continue;
        }
        console.warn(`[Veo] ${model.label} erro (${status}): ${msg.substring(0, 200)}`);
      }
    }
  } else {
    console.warn('[Veo] GEMINI_API_KEY não configurada');
  }

  // 3. Fallback: Runway ML (trial gratuito)
  if (RUNWAY_API_KEY) {
    console.log('[Veo] Tentando Runway ML...');
    const runwayResult = await generateRunwayVideo(prompt, options);
    if (runwayResult && runwayResult.length > 0) {
      console.log(`[Veo] Runway ✅ ${runwayResult.length} vídeo(s)`);
      return runwayResult;
    }
  } else {
    console.log('[Veo] RUNWAY_API_KEY não configurada');
  }

  return null;
}

async function generateRunwayVideo(prompt, options = {}) {
  const duration = options.durationSeconds || 5;

  try {
    const resp = await axios.post('https://api.runwayml.com/v1/videos', {
      prompt,
      model: 'gen3a_turbo',
      duration,
      aspect_ratio: options.aspectRatio || '9:16',
    }, {
      headers: { Authorization: `Bearer ${RUNWAY_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    const taskId = resp.data?.id;
    if (!taskId) {
      console.warn('[Runway] Sem task ID na resposta');
      console.log('[Runway] Resposta:', JSON.stringify(resp.data).substring(0, 300));
      return null;
    }

    console.log(`[Runway] Task criada: ${taskId}`);
    const videos = await pollRunwayTask(taskId);
    return videos;
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    const msg = data?.error || data?.message || err.message || '';
    console.warn(`[Runway] Erro (${status}): ${msg.substring(0, 200)}`);
    if (data) console.log('[Runway] Detalhe:', JSON.stringify(data).substring(0, 300));
    return null;
  }
}

async function pollRunwayTask(taskId, maxAttempts = 120) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const { data } = await axios.get(`https://api.runwayml.com/v1/videos/${taskId}`, {
        headers: { Authorization: `Bearer ${RUNWAY_API_KEY}` },
        timeout: 15000,
      });

      const status = data.status;
      if (status === 'completed') {
        const outputs = data.output || [];
        if (outputs.length === 0) {
          console.warn('[Runway] Task completed sem output');
          return null;
        }
        return outputs.map(url => ({
          videoUrl: url,
          mimeType: 'video/mp4',
        }));
      }

      if (status === 'failed') {
        console.warn(`[Runway] Task falhou: ${data.error || 'erro desconhecido'}`);
        return null;
      }

      if (i % 10 === 9) console.log(`[Runway] ${(i+1)*3}s aguardando... (${status})`);
    } catch (pollErr) {
      const status = pollErr.response?.status;
      const msg = pollErr.response?.data?.error || pollErr.response?.data?.message || pollErr.message || '';
      if (i === 0 || i % 10 === 9) console.log(`[Runway] Poll #${i} (${status}): ${msg.substring(0, 100)}`);
    }
  }
  console.warn('[Runway] Timeout');
  return null;
}

async function pollGeminiOperation(opName, maxAttempts = 90) {
  const url = `${GEMINI_BASE_URL}/${opName}`;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const { data } = await axios.get(url, {
        headers: { 'x-goog-api-key': API_KEY },
        timeout: 15000,
      });

      if (data.done) {
        if (data.error) {
          console.warn(`[Veo] Operação falhou: ${data.error.message}`);
          return null;
        }
        const samples = data.response?.generateVideoResponse?.generatedSamples || [];
        const videos = samples.map(s => ({
          videoUrl: s.video?.uri || '',
          mimeType: s.video?.mimeType || 'video/mp4',
        })).filter(v => v.videoUrl);
        return videos.length > 0 ? videos : null;
      }
      if (i % 15 === 14) console.log(`[Veo] ${(i+1)*2}s aguardando...`);
    } catch (pollErr) {
      const status = pollErr.response?.status;
      const msg = pollErr.response?.data?.error?.message || pollErr.message || '';
      if (i === 0 || i % 10 === 9) console.log(`[Veo] Poll #${i} (${status}): ${msg.substring(0, 100)}`);
    }
  }
  console.warn('[Veo] Timeout');
  return null;
}

module.exports = { generateVideo };
