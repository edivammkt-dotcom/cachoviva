const STAGES = [
  { id: 'pesquisar', label: 'Pesquisar', icon: '🔍' },
  { id: 'planejar', label: 'Planejar', icon: '📅' },
  { id: 'criar', label: 'Criar', icon: '✍️' },
  { id: 'editar', label: 'Editar', icon: '📝' },
  { id: 'validar', label: 'Validar', icon: '✅' },
  { id: 'aprovar', label: 'Aprovar', icon: '👍' },
  { id: 'publicar', label: 'Publicar', icon: '🚀' },
  { id: 'medir', label: 'Medir', icon: '📈' }
];

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'facebook'];
const STAGE_ORDER = STAGES.map(s => s.id);

let useServer = false;
let serverChecked = false;

async function checkServer() {
  if (serverChecked) return useServer;
  try {
    const connected = await api.checkConnection();
    useServer = connected;
  } catch {
    useServer = false;
  }
  serverChecked = true;
  return useServer;
}

function isOnline() {
  return navigator.onLine !== false;
}

async function getPosts() {
  try {
    if (await checkServer()) {
      return await api.getPosts();
    }
  } catch {}
  const data = loadLocalData();
  return data.posts || [];
}

async function getPostsByStage(stage) {
  const posts = await getPosts();
  return posts.filter(p => p.stage === stage);
}

async function getPost(id) {
  try {
    if (await checkServer()) {
      return await api.getPost(id);
    }
  } catch {}
  const data = loadLocalData();
  return data.posts.find(p => p.id === id) || null;
}

async function savePost(postData) {
  try {
    if (await checkServer()) {
      const result = await api.savePost(postData);
      return result;
    }
  } catch {}
  const data = loadLocalData();
  if (postData.id) {
    const idx = data.posts.findIndex(p => p.id === postData.id);
    if (idx >= 0) {
      data.posts[idx] = { ...data.posts[idx], ...postData, updatedAt: Date.now() };
    }
  } else {
    const newPost = {
      ...postData,
      id: generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      feedback: [],
      metrics: null
    };
    data.posts.push(newPost);
  }
  saveLocalData(data);
  return data.posts;
}

async function deletePost(id) {
  try {
    if (await checkServer()) {
      await api.deletePost(id);
      return;
    }
  } catch {}
  const data = loadLocalData();
  data.posts = data.posts.filter(p => p.id !== id);
  saveLocalData(data);
}

async function movePost(postId, targetStage) {
  try {
    if (await checkServer()) {
      await api.advancePost(postId);
      return true;
    }
  } catch {}
  const data = loadLocalData();
  const post = data.posts.find(p => p.id === postId);
  if (post && STAGE_ORDER.indexOf(targetStage) === STAGE_ORDER.indexOf(post.stage) + 1) {
    post.stage = targetStage;
    post.updatedAt = Date.now();
    const member = data.team.find(m => m.stage === targetStage);
    if (member) post.assignedTo = member.name;
    saveLocalData(data);
    return true;
  }
  return false;
}

async function addFeedback(postId, text) {
  try {
    if (await checkServer()) {
      await api.sendFeedback(postId, text);
      return true;
    }
  } catch {}
  const data = loadLocalData();
  const post = data.posts.find(p => p.id === postId);
  if (post) {
    if (!post.feedback) post.feedback = [];
    post.feedback.push({ text, by: 'Sistema', date: new Date().toLocaleDateString('pt-BR') });
    post.stage = 'editar';
    post.updatedAt = Date.now();
    const editor = data.team.find(m => m.stage === 'editar');
    if (editor) post.assignedTo = editor.name;
    saveLocalData(data);
    return true;
  }
  return false;
}

async function approvePost(postId) {
  try {
    if (await checkServer()) {
      await api.advancePost(postId);
      return true;
    }
  } catch {}
  const data = loadLocalData();
  const post = data.posts.find(p => p.id === postId);
  if (post && post.stage === 'aprovar') {
    const targetIdx = STAGE_ORDER.indexOf('aprovar') + 1;
    const nextStage = STAGE_ORDER[targetIdx];
    post.stage = nextStage;
    post.updatedAt = Date.now();
    const member = data.team.find(m => m.stage === nextStage);
    if (member) post.assignedTo = member.name;
    saveLocalData(data);
    return true;
  }
  return false;
}

async function publishPost(postId, date) {
  try {
    if (await checkServer()) {
      await api.publishPost(postId, date);
      return true;
    }
  } catch {}
  const data = loadLocalData();
  const post = data.posts.find(p => p.id === postId);
  if (!post) return false;
  if (post.stage === 'publicar' || post.stage === 'aprovar') {
    const nextStage = STAGE_ORDER[STAGE_ORDER.indexOf('publicar') + 1];
    post.stage = nextStage;
    post.scheduledDate = date;
    post.publishedDate = date;
    post.updatedAt = Date.now();
    const member = data.team.find(m => m.stage === nextStage);
    if (member) post.assignedTo = member.name;
    saveLocalData(data);
    return true;
  }
  return false;
}

async function updateMetrics(postId, metrics) {
  try {
    if (await checkServer()) {
      await api.updateMetrics(postId, metrics);
      return true;
    }
  } catch {}
  const data = loadLocalData();
  const post = data.posts.find(p => p.id === postId);
  if (post) {
    post.metrics = { ...post.metrics, ...metrics };
    post.updatedAt = Date.now();
    saveLocalData(data);
    return true;
  }
  return false;
}

async function getTeam() {
  try {
    if (await checkServer()) {
      return await api.getTeam();
    }
  } catch {}
  const data = loadLocalData();
  return data.team || DEFAULT_TEAM;
}

async function updateTeamMember(role, name) {
  try {
    if (await checkServer()) {
      await api.updateTeamMember(role, name);
      return;
    }
  } catch {}
  const data = loadLocalData();
  const member = data.team.find(m => m.role === role);
  if (member) {
    member.name = name;
    saveLocalData(data);
  }
}

async function getCounts() {
  try {
    if (await checkServer()) {
      return await api.getCounts();
    }
  } catch {}
  const posts = await getPosts();
  const counts = {};
  STAGES.forEach(s => { counts[s.id] = 0; });
  posts.forEach(p => {
    if (counts[p.stage] !== undefined) counts[p.stage]++;
  });
  return counts;
}

async function getRecentActivity(limit = 10) {
  try {
    if (await checkServer()) {
      return await api.getActivity();
    }
  } catch {}
  const posts = await getPosts();
  const activities = [];
  posts.forEach(p => {
    activities.push({
      id: p.id + '-created',
      postId: p.id,
      postTitle: p.title,
      action: 'foi criado',
      stage: p.stage,
      time: new Date(p.createdAt).toLocaleDateString('pt-BR')
    });
    if (p.updatedAt !== p.createdAt) {
      activities.push({
        id: p.id + '-updated',
        postId: p.id,
        postTitle: p.title,
        action: `foi movido para "${getStageLabel(p.stage)}"`,
        stage: p.stage,
        time: new Date(p.updatedAt).toLocaleDateString('pt-BR')
      });
    }
  });
  activities.sort((a, b) => new Date(b.time) - new Date(a.time) || (b.postId || '').localeCompare(a.postId || ''));
  return activities.slice(0, limit);
}

function getStageLabel(stageId) {
  const stage = STAGES.find(s => s.id === stageId);
  return stage ? stage.label : stageId;
}

function getStageIcon(stageId) {
  const stage = STAGES.find(s => s.id === stageId);
  return stage ? stage.icon : '';
}

function getPlatformLabel(platform) {
  const labels = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    twitter: 'Twitter / X',
    linkedin: 'LinkedIn',
    facebook: 'Facebook'
  };
  return labels[platform] || platform;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

const STORAGE_KEY = 'cachoviva_data';
const DEFAULT_TEAM = [
  { role: 'Pesquisador', name: 'Ana Pesquisa', stage: 'pesquisar' },
  { role: 'Planejador', name: 'Bruno Planeja', stage: 'planejar' },
  { role: 'Criador', name: 'Carla Cria', stage: 'criar' },
  { role: 'Editor', name: 'Diego Edita', stage: 'editar' },
  { role: 'Validador', name: 'Eva Valida', stage: 'validar' },
  { role: 'Aprovador', name: 'Fábio Aprova', stage: 'aprovar' },
  { role: 'Publicador', name: 'Gabi Publica', stage: 'publicar' },
  { role: 'Analista', name: 'Hugo Mede', stage: 'medir' }
];

const SAMPLE_POSTS = [
  { id: '1', title: 'Como finalizar cabelos cacheados', description: 'Passo a passo completo de finalização para cabelos cacheados tipo 3A-3C', platform: 'instagram', stage: 'pesquisar', assignedTo: 'Ana Pesquisa', content: '', hashtags: ['#cachosdefinidos', '#finalizacao', '#cabelocacheado'], scheduledDate: '', publishedDate: '', metrics: null, createdAt: Date.now() - 86400000 * 5, updatedAt: Date.now() - 86400000 * 5, feedback: [] },
  { id: '2', title: 'Review: Linha Umectação CachoViva', description: 'Review completo da nova linha de umectação, benefícios e resultados', platform: 'youtube', stage: 'criar', assignedTo: 'Carla Cria', content: 'Roteiro: 1. Introdução 2. Apresentação dos produtos 3. Demonstração 4. Resultados 5. Conclusão', hashtags: ['#umectacao', '#cachoviva', '#review'], scheduledDate: '', publishedDate: '', metrics: null, createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 86400000 * 2, feedback: [] },
  { id: '3', title: 'Dica rápida: Difusor perfeito', description: 'Tutorial rápido de como usar o difusor para volume e definição', platform: 'tiktok', stage: 'aprovar', assignedTo: 'Fábio Aprova', content: 'Vídeo de 60s mostrando técnica de difusão', hashtags: ['#dicadodia', '#difusor', '#cachos'], scheduledDate: '', publishedDate: '', metrics: null, createdAt: Date.now() - 86400000 * 1, updatedAt: Date.now() - 86400000 * 1, feedback: ['Aumentar tempo de demonstração'] },
  { id: '4', title: 'Cronograma capilar mensal', description: 'Guia completo de cronograma capilar para todos os tipos de cacho', platform: 'instagram', stage: 'medir', assignedTo: 'Hugo Mede', content: 'Post carrossel com 8 slides', hashtags: ['#cronogramacapilar', '#cuidadoscomocabelo'], scheduledDate: '2026-05-10', publishedDate: '2026-05-10', metrics: { likes: 234, comments: 45, shares: 89, reach: 3500, saves: 120 }, createdAt: Date.now() - 86400000 * 12, updatedAt: Date.now() - 86400000 * 2, feedback: [] },
  { id: '5', title: 'Os 5 erros na transição capilar', description: 'Erros comuns que atrapalham a transição capilar e como evitá-los', platform: 'youtube', stage: 'editar', assignedTo: 'Diego Edita', content: 'Roteiro completo para vídeo de 8 minutos', hashtags: ['#transicaocapilar', '#cachos', '#dicas'], scheduledDate: '', publishedDate: '', metrics: null, createdAt: Date.now() - 86400000 * 4, updatedAt: Date.now() - 86400000 * 1, feedback: ['Adicionar exemplos visuais', 'Revisar estatísticas'] }
];

function loadLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.initialized) return data;
    }
  } catch (e) {}
  const data = { posts: JSON.parse(JSON.stringify(SAMPLE_POSTS)), team: JSON.parse(JSON.stringify(DEFAULT_TEAM)), initialized: true };
  saveLocalData(data);
  return data;
}

function saveLocalData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}

async function resetData() {
  try {
    if (await checkServer()) {
      const data = { posts: JSON.parse(JSON.stringify(SAMPLE_POSTS)), team: JSON.parse(JSON.stringify(DEFAULT_TEAM)), initialized: true };
      saveLocalData(data);
      return data;
    }
  } catch {}
  const data = { posts: JSON.parse(JSON.stringify(SAMPLE_POSTS)), team: JSON.parse(JSON.stringify(DEFAULT_TEAM)), initialized: true };
  saveLocalData(data);
  return data;
}

// === BRIEFING FRONTEND HELPERS ===
async function getActiveBriefing() {
  try {
    if (await checkServer()) return await api.getActiveBriefing();
  } catch {}
  const data = loadLocalData();
  return { success: true, briefing: data.activeBriefing || null };
}

async function saveBriefing(content, platformFocus = 'instagram') {
  try {
    if (await checkServer()) return await api.saveBriefing(content, platformFocus);
  } catch {}
  const data = loadLocalData();
  data.activeBriefing = { id: generateId(), content, platform_focus: platformFocus, active: 1, created_at: Date.now(), source: 'manual' };
  saveLocalData(data);
  return data.activeBriefing;
}

// === SUGGESTIONS FRONTEND HELPERS ===
async function getSuggestions(status = null) {
  try {
    if (await checkServer()) return await api.getSuggestions(status);
  } catch {}
  const data = loadLocalData();
  let suggestions = data.suggestions || [];
  if (status) suggestions = suggestions.filter(s => s.status === status);
  return { success: true, suggestions };
}

async function approveSuggestion(id) {
  try {
    if (await checkServer()) return await api.approveSuggestion(id);
  } catch {}
  const data = loadLocalData();
  const sug = (data.suggestions || []).find(s => s.id === id);
  if (sug) {
    sug.status = 'approved';
    const newPost = {
      id: generateId(),
      title: sug.title,
      description: sug.description || '',
      platform: sug.platform,
      stage: 'criar',
      assignedTo: 'Carla Cria',
      hashtags: sug.hashtags || [],
      content: sug.content_generated || '',
      feedback: [],
      metrics: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    data.posts.push(newPost);
    saveLocalData(data);
    return { success: true, post: newPost };
  }
  return { success: false, error: 'Sugestao nao encontrada' };
}
