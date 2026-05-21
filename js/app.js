let currentView = 'dashboard';
let editingPostId = null;

function init() {
  renderCurrentDate();
  setupNavigation();
  setupMenuToggle();
  setupNewPostButton();
  setupModalClose();
  setupServerStatus();
  navigateTo('dashboard');
}

async function setupServerStatus() {
  const footer = document.querySelector('.sidebar-footer');
  if (!footer) return;
  const badge = document.createElement('div');
  badge.id = 'serverStatus';
  badge.style.cssText = 'font-size:0.7rem;padding:4px 8px;border-radius:6px;margin-top:4px;text-align:center;';
  badge.textContent = '🔌 Verificando...';
  badge.style.background = 'rgba(255,255,255,0.1)';
  badge.style.color = 'rgba(255,255,255,0.6)';
  footer.appendChild(badge);
  try {
    const connected = await api.checkConnection();
    if (connected) {
      badge.textContent = '🟢 Servidor conectado';
      badge.style.background = 'rgba(16,185,129,0.2)';
      badge.style.color = '#6EE7B7';
    } else {
      badge.textContent = '🟡 Modo local';
      badge.style.background = 'rgba(245,158,11,0.2)';
      badge.style.color = '#FCD34D';
    }
  } catch {
    badge.textContent = '🟡 Modo local';
    badge.style.background = 'rgba(245,158,11,0.2)';
    badge.style.color = '#FCD34D';
  }
}

function renderCurrentDate() {
  const el = document.getElementById('currentDate');
  if (el) {
    el.textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }
}

function setupNavigation() {
  document.querySelectorAll('.stage-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.view);
      document.getElementById('sidebar').classList.remove('open');
    });
  });
}

function setupMenuToggle() {
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('menuToggle');
    if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !toggle.contains(e.target) && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
    }
  });
}

function setupNewPostButton() {
  document.getElementById('btnNewPost').addEventListener('click', () => openPostModal());
}

function setupModalClose() {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalClose').addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
}

document.addEventListener('DOMContentLoaded', init);
document.getElementById('btnConfig').addEventListener('click', openSettings);

function navigateTo(view) {
  currentView = view;
  updateActiveNav(view);
  updatePageTitle(view);
  updateCounts();
  renderView(view);
}

function updateActiveNav(view) {
  document.querySelectorAll('.stage-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
}

function updatePageTitle(view) {
  const labels = {
    dashboard: 'Dashboard',
    pesquisar: 'Pesquisar — Ideias e Tendências',
    planejar: 'Planejar — Estratégia e Calendário',
    criar: 'Criar — Produção de Conteúdo',
    editar: 'Editar — Revisão e Ajustes',
    validar: 'Validar — Verificação Final',
    aprovar: 'Aprovar — Aprovação Final',
    publicar: 'Publicar — Agendamento e Postagem',
    medir: 'Métricas e Resultados'
  };
  document.getElementById('pageTitle').textContent = labels[view] || 'Dashboard';
}

async function updateCounts() {
  try {
    const counts = await getCounts();
    Object.keys(counts).forEach(key => {
      const el = document.getElementById(`count-${key}`);
      if (el) el.textContent = counts[key];
    });
  } catch {}
}

async function renderView(view) {
  const area = document.getElementById('contentArea');
  if (!area) return;
  renderPipelineBar();
  if (view === 'dashboard') { await renderDashboard(area); return; }
  if (view === 'medir') { await renderMetricsView(area); return; }
  await renderStageView(area, view);
}

function renderPipelineBar() {
  const bar = document.getElementById('pipelineBar');
  if (!bar) return;
  getCounts().then(counts => {
    bar.innerHTML = STAGES.map(s => `
      <div class="pipe-step ${currentView === s.id ? 'pipe-active' : ''}" onclick="navigateTo('${s.id}')">
        <div class="pipe-icon">${s.icon}</div>
        <div class="pipe-count">${counts[s.id] || 0}</div>
        <div class="pipe-label">${s.label}</div>
      </div>
    `).join('');
  }).catch(() => {});
}

async function renderDashboard(area) {
  const posts = await getPosts();
  const counts = await getCounts();
  const published = posts.filter(p => p.stage === 'medir').length;
  const inProgress = posts.filter(p => p.stage !== 'medir').length;
  const totalEngagement = posts.reduce((acc, p) => {
    if (p.metrics) return acc + (p.metrics.likes || 0) + (p.metrics.comments || 0) + (p.metrics.shares || 0);
    return acc;
  }, 0);

  area.innerHTML = `
    <div class="dashboard-grid">
      <div class="stat-card"><h3>${posts.length}</h3><p>Total de Conteúdos</p></div>
      <div class="stat-card"><h3>${inProgress}</h3><p>Em Produção</p></div>
      <div class="stat-card"><h3>${published}</h3><p>Publicados</p></div>
      <div class="stat-card"><h3>${totalEngagement > 0 ? totalEngagement.toLocaleString() : '—'}</h3><p>Engajamento Total</p></div>
    </div>
    <div class="recent-activity"><h3>📋 Atividades Recentes</h3>${await renderActivities()}</div>
  `;
}

async function renderActivities() {
  try {
    const activities = await getRecentActivity(8);
    if (!activities || activities.length === 0) return '<p style="color: var(--text-secondary); font-size: 0.85rem;">Nenhuma atividade recente.</p>';
    return activities.map(a => `
      <div class="activity-item">
        <span class="activity-icon">${getStageIcon(a.stage)}</span>
        <span class="activity-text"><strong>${escHtml(a.postTitle)}</strong> ${a.action}</span>
        <span class="activity-time">${a.time}</span>
      </div>
    `).join('');
  } catch { return '<p style="color: var(--text-secondary);">Nenhuma atividade.</p>'; }
}

async function renderStageView(area, stage) {
  const posts = await getPostsByStage(stage);
  const stageInfo = STAGES.find(s => s.id === stage);
  const nextStage = STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1];
  const prevStage = STAGE_ORDER[STAGE_ORDER.indexOf(stage) - 1];

  let aiSection = '';
  if (stage === 'pesquisar') {
    aiSection = `
      <div class="ai-section">
        <div class="ai-section-header" onclick="toggleAiSection(this)">
          <span>📋 Briefing</span>
          <span class="ai-toggle">▼</span>
        </div>
        <div class="ai-section-body" id="briefingSectionBody"><div id="briefingDisplay"></div></div>
      </div>
      <div class="ai-section">
        <div class="ai-section-header" onclick="toggleAiSection(this)">
          <span>💡 Sugestões da IA</span>
          <span class="ai-toggle">▼</span>
        </div>
        <div class="ai-section-body">
          <div id="suggestionsList"><p style="color:var(--text-secondary);font-size:0.85rem;">Carregando...</p></div>
          <div style="margin-top:12px;display:flex;gap:8px;">
            <button class="btn-primary btn-sm" onclick="triggerResearchNow()">🔍 Pesquisar Agora</button>
            <button class="btn-secondary btn-sm" onclick="openKeywordsManager()">🔑 Keywords</button>
          </div>
        </div>
      </div>
      <div class="ai-section">
        <div class="ai-section-header" onclick="toggleAiSection(this)">
          <span>🤖 Gerar Ideias</span>
          <span class="ai-toggle">▼</span>
        </div>
        <div class="ai-section-body">
          <div class="form-row">
            <div class="form-group" style="flex:2;">
              <label for="aiTopic">Tema</label>
              <input type="text" id="aiTopic" placeholder="Ex: finalização, transição capilar..." style="width:100%;">
            </div>
            <div class="form-group" style="flex:1;">
              <label for="aiPlatform">Plataforma</label>
              <select id="aiPlatform" style="width:100%;">${PLATFORMS.map(p => `<option value="${p}">${getPlatformLabel(p)}</option>`).join('')}</select>
            </div>
          </div>
          <button class="btn-primary" onclick="generateIdeasAction()">🔍 Gerar Ideias</button>
          <div id="aiResults" style="margin-top:16px;"></div>
        </div>
      </div>`;
    setTimeout(() => { loadBriefingDisplay(); loadSuggestions(); }, 50);
  } else if (stage === 'criar') {
    aiSection = `
      <div class="ai-section" style="border-color:var(--green-600);border-width:2px;">
        <div class="ai-section-header" style="background:var(--green-100);border-bottom:1px solid var(--green-300);cursor:default;">
          <span>🤖 Criar Conteúdo com IA — CachoViva</span>
        </div>
        <div class="ai-section-body">
          <div class="form-row">
            <div class="form-group" style="flex:2;">
              <label for="aiCreateTopic">Tema do Post</label>
              <input type="text" id="aiCreateTopic" placeholder="Ex: Como finalizar cachos tipo 3C" style="width:100%;">
            </div>
            <div class="form-group" style="flex:1;">
              <label for="aiCreatePlatform">Plataforma</label>
              <select id="aiCreatePlatform" style="width:100%;">${PLATFORMS.map(p => `<option value="${p}">${getPlatformLabel(p)}</option>`).join('')}</select>
            </div>
          </div>
          <div class="form-group">
            <label for="aiCreatePilar">Pilar de Conteúdo (opcional)</label>
            <select id="aiCreatePilar" style="width:100%;">
              <option value="">Automático</option>
              <option value="Prova Social">📸 Prova Social</option>
              <option value="Educação que Vende">📚 Educação que Vende</option>
              <option value="Identidade">💪 Identidade e Empoderamento</option>
              <option value="Bastidor">🔧 Bastidor e Humanização</option>
              <option value="Conversão">🛒 Conversão Direta</option>
            </select>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn-primary" onclick="generatePreviewAction()">✨ Gerar Post Completo</button>
          </div>
          <div id="previewContainer" style="margin-top:20px;"></div>
        </div>
      </div>`;
  }

  if (posts.length === 0) {
    area.innerHTML = `${aiSection}<div class="empty-state"><div class="empty-state-icon">${stageInfo.icon}</div><h3>Nenhum conteúdo em "${stageInfo.label}"</h3><p>Clique em "+ Novo" ou use a IA acima.</p></div>`;
    return;
  }

  area.innerHTML = `
    ${aiSection}
    <div style="margin: 16px 0; display: flex; justify-content: space-between; align-items: center;">
      <p style="color: var(--text-secondary); font-size: 0.85rem;">
        ${posts.length} conteúdo(s)
        ${prevStage ? `<button class="btn-secondary btn-sm" onclick="navigateTo('${prevStage}')">← ${getStageLabel(prevStage)}</button>` : ''}
        ${nextStage ? `<button class="btn-secondary btn-sm" onclick="navigateTo('${nextStage}')">${getStageLabel(nextStage)} →</button>` : ''}
      </p>
    </div>
    <div class="posts-grid">${posts.map(p => renderPostCard(p, stage)).join('')}</div>
  `;
}

function renderPostCard(post, stage) {
  let actions = '';
  if (stage === 'aprovar') {
    actions = `<button class="btn-secondary btn-sm" onclick="openFeedbackModal('${post.id}')">📝 Ajustes</button><button class="btn-success btn-sm" onclick="approveAndPublish('${post.id}')">👍 Aprovar</button>`;
  } else if (stage === 'criar') {
    actions = `<button class="btn-secondary btn-sm" onclick="openEditModal('${post.id}')">✏️ Editar</button><button class="btn-success btn-sm" onclick="markReadyForApproval('${post.id}')">✅ Pronto</button>`;
  } else if (stage === 'publicar') {
    actions = `<button class="btn-success btn-sm" onclick="openPublishModal('${post.id}')">🚀 Publicar</button>`;
  } else if (stage === 'pesquisar') {
    actions = `<button class="btn-primary btn-sm" onclick="advancePost('${post.id}')">Avançar →</button>`;
  } else {
    actions = `<button class="btn-primary btn-sm" onclick="advancePost('${post.id}')">Avançar →</button>`;
  }

  let imgPreview = '';
  if (stage === 'criar' || stage === 'aprovar') {
    try {
      const c = typeof post.content === 'string' ? JSON.parse(post.content) : (post.content || {});
      if (c.image) imgPreview = `<div class="post-thumb"><img src="${c.image}" alt=""></div>`;
    } catch {}
  }

  return `
    <div class="post-card">
      ${imgPreview}
      <div class="post-card-header">
        <div class="post-card-title">${escHtml(post.title)}</div>
        <span class="post-platform ${post.platform}">${getPlatformLabel(post.platform)}</span>
      </div>
      <div class="post-card-body">${escHtml(post.description || '')}</div>
      <div class="post-card-footer">
        <span>👤 ${escHtml(post.assignedTo || '—')}</span>
        <span>📅 ${post.scheduledDate || '—'}</span>
      </div>
      <div class="post-card-actions">${actions}<button class="btn-icon" onclick="openViewModal('${post.id}')">👁️</button></div>
    </div>
  `;
}

async function renderMetricsView(area) {
  const posts = await getPostsByStage('medir');
  const totalLikes = posts.reduce((acc, p) => acc + (p.metrics?.likes || 0), 0);
  const totalComments = posts.reduce((acc, p) => acc + (p.metrics?.comments || 0), 0);
  const totalShares = posts.reduce((acc, p) => acc + (p.metrics?.shares || 0), 0);
  const totalReach = posts.reduce((acc, p) => acc + (p.metrics?.reach || 0), 0);
  const totalSaves = posts.reduce((acc, p) => acc + (p.metrics?.saves || 0), 0);
  const engagement = totalReach > 0 ? ((totalLikes + totalComments + totalShares) / totalReach * 100).toFixed(1) : '0';

  // GA4 data
  var ga4html = '';
  try {
    var ga4 = await api.getGA4Metrics();
    if (ga4.configured && ga4.overview) {
      var o = ga4.overview;
      var sourcesHtml = (ga4.trafficSources || []).slice(0, 5).map(function(s) {
        var max = Math.max.apply(null, (ga4.trafficSources || []).map(function(x) { return x.sessions; }));
        var pct = max > 0 ? (s.sessions / max * 100) : 0;
        return '<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:0.85rem;">' +
          '<span style="width:80px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(s.source) + '</span>' +
          '<div style="flex:1;height:18px;background:var(--bg-secondary);border-radius:4px;overflow:hidden;">' +
          '<div style="width:' + pct + '%;height:100%;background:var(--accent-gradient, linear-gradient(135deg,#B8541A,#D4783A));border-radius:4px;"></div></div>' +
          '<span style="width:40px;text-align:right;">' + s.sessions + '</span></div>';
      }).join('');

      var dailyHtml = (ga4.daily || []).slice(-7).map(function(d) {
        return '<div style="display:flex;align-items:center;gap:6px;margin:2px 0;font-size:0.8rem;">' +
          '<span style="width:75px;">' + d.date.slice(5) + '</span>' +
          '<span>👁️ ' + d.pageViews + '</span>' +
          '<span style="color:var(--text-secondary);">👤 ' + d.users + '</span></div>';
      }).join('');

      ga4html = '<div class="ga4-section" style="margin:20px 0;padding:16px;background:var(--bg-card);border-radius:12px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
          '<h3 style="margin:0;">📊 Google Analytics — Landing Page</h3>' +
          '<span style="font-size:0.75rem;color:var(--text-secondary);">' + new Date(ga4.fetchedAt).toLocaleString('pt-BR') + '</span></div>' +
        '<div class="metrics-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:16px;">' +
          '<div class="metric-card" style="padding:10px;"><div class="metric-value" style="font-size:1.2rem;">' + (o.pageViews || 0).toLocaleString() + '</div><div class="metric-label">👁️ Page Views</div></div>' +
          '<div class="metric-card" style="padding:10px;"><div class="metric-value" style="font-size:1.2rem;">' + (o.totalUsers || 0).toLocaleString() + '</div><div class="metric-label">👤 Usuários</div></div>' +
          '<div class="metric-card" style="padding:10px;"><div class="metric-value" style="font-size:1.2rem;">' + (o.sessions || 0).toLocaleString() + '</div><div class="metric-label">🔄 Sessões</div></div>' +
          '<div class="metric-card" style="padding:10px;"><div class="metric-value" style="font-size:1.2rem;">' + (o.bounceRate || '0%') + '</div><div class="metric-label">📉 Taxa Rejeição</div></div>' +
          '<div class="metric-card" style="padding:10px;"><div class="metric-value" style="font-size:1.2rem;">' + (o.avgSessionDuration || '0s') + '</div><div class="metric-label">⏱️ Duração Média</div></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
          '<div><h4 style="margin:0 0 8px;font-size:0.9rem;">🌐 Tráfego (últimos 7 dias)</h4>' + dailyHtml + '</div>' +
          '<div><h4 style="margin:0 0 8px;font-size:0.9rem;">🔗 Fontes de Tráfego</h4>' + sourcesHtml + '</div>' +
        '</div></div>';
    } else if (!ga4.configured) {
      ga4html = '<div class="ga4-section" style="margin:20px 0;padding:16px;background:var(--bg-card);border-radius:12px;">' +
        '<div style="text-align:center;padding:20px;">' +
          '<h3 style="margin:0 0 8px;">📊 Google Analytics</h3>' +
          '<p style="color:var(--text-secondary);font-size:0.85rem;">GA4 não configurado. Configure as variáveis GA4_PROPERTY_ID, GA4_CLIENT_EMAIL e GA4_PRIVATE_KEY no .env</p>' +
        '</div></div>';
    }
  } catch(e) {
    ga4html = '<div class="ga4-section" style="margin:20px 0;padding:16px;background:var(--bg-card);border-radius:12px;">' +
      '<p style="color:var(--text-secondary);text-align:center;">📊 Google Analytics indisponível</p></div>';
  }

  area.innerHTML = `
    <div class="metrics-grid">
      <div class="metric-card"><div class="metric-value">${totalLikes.toLocaleString()}</div><div class="metric-label">❤️ Curtidas</div></div>
      <div class="metric-card"><div class="metric-value">${totalComments.toLocaleString()}</div><div class="metric-label">💬 Comentários</div></div>
      <div class="metric-card"><div class="metric-value">${totalShares.toLocaleString()}</div><div class="metric-label">🔁 Compart.</div></div>
      <div class="metric-card"><div class="metric-value">${totalReach.toLocaleString()}</div><div class="metric-label">👁️ Alcance</div></div>
      <div class="metric-card"><div class="metric-value">${totalSaves.toLocaleString()}</div><div class="metric-label">💾 Salvos</div></div>
      <div class="metric-card"><div class="metric-value">${engagement}%</div><div class="metric-label">📊 Engajamento</div></div>
    </div>
    ${ga4html}
    <h3 style="margin-bottom:12px;">📋 Publicados</h3>
    <div class="posts-grid">
      ${posts.map(p => {
        const m = p.metrics || {};
        return `<div class="post-card">
          <div class="post-card-header"><div class="post-card-title">${escHtml(p.title)}</div><span class="post-platform ${p.platform}">${getPlatformLabel(p.platform)}</span></div>
          <div class="post-card-body" style="display:flex;gap:12px;font-size:0.8rem;">
            <span>❤️ ${m.likes||0}</span><span>💬 ${m.comments||0}</span><span>🔁 ${m.shares||0}</span><span>👁️ ${m.reach||0}</span>
          </div>
          <div class="post-card-footer"><span>📅 ${p.publishedDate||p.scheduledDate||''}</span><button class="btn-secondary btn-sm" onclick="openMetricsModal('${p.id}')">✏️</button></div>
        </div>`;
      }).join('')}
    </div>`;
}

async function openPostModal(postId = null) {
  editingPostId = postId;
  const post = postId ? await getPost(postId) : null;
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = post ? 'Editar Conteúdo' : 'Novo Conteúdo';
  const team = await getTeam();

  document.getElementById('modalBody').innerHTML = `
    <form id="postForm" onsubmit="return savePostForm(event)">
      <div class="form-group"><label>Título</label><input type="text" id="postTitle" value="${post ? escHtml(post.title) : ''}" required></div>
      <div class="form-group"><label>Descrição</label><textarea id="postDescription">${post ? escHtml(post.description||'') : ''}</textarea></div>
      <div class="form-row">
        <div class="form-group"><label>Plataforma</label>
          <select id="postPlatform">${PLATFORMS.map(p => `<option value="${p}" ${post&&post.platform===p?'selected':''}>${getPlatformLabel(p)}</option>`).join('')}</select></div>
        <div class="form-group"><label>Etapa</label>
          <select id="postStage">${STAGES.map(s => `<option value="${s.id}" ${post&&post.stage===s.id?'selected':''}>${s.label}</option>`).join('')}</select></div>
      </div>
      <div class="form-group"><label>Hashtags (separadas por vírgula)</label><input type="text" id="postHashtags" value="${post ? (post.hashtags||[]).join(', ') : ''}"></div>
      <div class="form-group"><label>Conteúdo</label><textarea id="postContent">${post ? escHtml(post.content||'') : ''}</textarea></div>
      ${!post ? '' : `<div class="form-group"><label>Responsável</label>
        <select id="postAssignee"><option value="">Selecione...</option>
        ${team.map(m => `<option value="${escHtml(m.name)}" ${post&&post.assignedTo===m.name?'selected':''}>${escHtml(m.name)}</option>`).join('')}</select></div>`}
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn-primary">${post ? 'Salvar' : 'Criar'}</button>
      </div>
    </form>`;
  overlay.classList.remove('hidden');
}

async function savePostForm(event) {
  event.preventDefault();
  const title = document.getElementById('postTitle').value.trim();
  if (!title) return false;

  const postData = {
    title,
    description: document.getElementById('postDescription').value.trim(),
    platform: document.getElementById('postPlatform').value,
    stage: editingPostId ? document.getElementById('postStage').value : 'pesquisar',
    hashtags: document.getElementById('postHashtags').value.split(',').map(h => h.trim()).filter(Boolean),
    content: document.getElementById('postContent').value.trim()
  };

  if (editingPostId) {
    const existing = await getPost(editingPostId);
    if (existing) {
      postData.id = editingPostId;
      const assignee = document.getElementById('postAssignee');
      postData.assignedTo = assignee ? assignee.value : existing.assignedTo;
      postData.scheduledDate = existing.scheduledDate;
      postData.publishedDate = existing.publishedDate;
      postData.feedback = existing.feedback;
      postData.metrics = existing.metrics;
      postData.createdAt = existing.createdAt;
    }
  }

  await savePost(postData);
  closeModal();
  editingPostId = null;
  await updateCounts();
  navigateTo(currentView);
  return false;
}

async function openViewModal(postId) {
  const post = await getPost(postId);
  if (!post) return;
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = post.title;

  const feedbackHtml = (post.feedback && post.feedback.length > 0)
    ? post.feedback.map(f => `<div class="feedback-item"><strong>${escHtml(f.by)}</strong> — ${escHtml(f.text)}<div class="feedback-date">${f.date}</div></div>`).join('')
    : '<p style="color:var(--text-secondary);font-size:0.85rem;">Sem feedback.</p>';

  let contentHtml = '';
  if (post.content) {
    let contentData = post.content;
    let imageUrl = null;
    try {
      const parsed = typeof post.content === 'string' ? JSON.parse(post.content) : post.content;
      if (parsed.image) { imageUrl = parsed.image; contentData = ''; }
      else { contentData = typeof post.content === 'string' ? post.content : JSON.stringify(post.content); }
    } catch { contentData = post.content; }
    if (imageUrl) contentHtml = `<div class="detail-field"><div class="detail-field-label">Imagem</div><img src="${imageUrl}" style="max-width:100%;border-radius:var(--radius-sm);margin-top:4px;box-shadow:var(--shadow);"></div>`;
    if (contentData) contentHtml += `<div class="detail-field" style="margin-top:12px;"><div class="detail-field-label">Conteúdo</div><div class="detail-field-value" style="white-space:pre-wrap;">${escHtml(contentData)}</div></div>`;
  }

  document.getElementById('modalBody').innerHTML = `
    <div class="detail-view">
      <div class="detail-field"><div class="detail-field-label">Descrição</div><div class="detail-field-value">${post.description||'—'}</div></div>
      <div class="form-row" style="margin-top:12px;">
        <div class="detail-field"><div class="detail-field-label">Plataforma</div><div class="detail-field-value"><span class="post-platform ${post.platform}">${getPlatformLabel(post.platform)}</span></div></div>
        <div class="detail-field"><div class="detail-field-label">Etapa</div><div class="detail-field-value"><span class="stage-badge ${post.stage}">${getStageLabel(post.stage)}</span></div></div>
      </div>
      <div class="form-row">
        <div class="detail-field"><div class="detail-field-label">Responsável</div><div class="detail-field-value">👤 ${post.assignedTo||'—'}</div></div>
        <div class="detail-field"><div class="detail-field-label">Agendado</div><div class="detail-field-value">📅 ${post.scheduledDate||'—'}</div></div>
      </div>
      ${contentHtml}
      <div class="detail-field" style="margin-top:16px;"><div class="detail-field-label">📊 Métricas</div>
        ${post.metrics ? `<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;"><span>❤️ ${post.metrics.likes||0}</span><span>💬 ${post.metrics.comments||0}</span><span>🔁 ${post.metrics.shares||0}</span><span>👁️ ${post.metrics.reach||0}</span><span>💾 ${post.metrics.saves||0}</span></div>` : '<span style="color:var(--text-secondary);">—</span>'}</div>
      <div class="detail-field" style="margin-top:16px;"><div class="detail-field-label">💬 Feedback</div>${feedbackHtml}</div>
      <div class="form-actions" style="margin-top:16px;"><button class="btn-secondary" onclick="closeModal()">Fechar</button><button class="btn-primary" onclick="openEditModal('${post.id}');">✏️ Editar</button></div>
    </div>`;
  overlay.classList.remove('hidden');
}

async function openFeedbackModal(postId) {
  const post = await getPost(postId);
  if (!post) return;
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = `Feedback: ${post.title}`;
  document.getElementById('modalBody').innerHTML = `
    <form id="feedbackForm" onsubmit="return submitFeedback(event, '${postId}')">
      <div class="form-group"><label>Descreva os ajustes</label><textarea id="feedbackText" required placeholder="Ex: revisar ortografia..."></textarea></div>
      <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:16px;">⚠️ Volta para Editar.</p>
      <div class="form-actions"><button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button><button type="submit" class="btn-primary">Enviar</button></div>
    </form>`;
  overlay.classList.remove('hidden');
}

async function submitFeedback(event, postId) {
  event.preventDefault();
  const text = document.getElementById('feedbackText').value.trim();
  if (!text) return false;
  await addFeedback(postId, text);
  closeModal();
  await updateCounts();
  navigateTo(currentView);
  return false;
}

async function openPublishModal(postId) {
  const post = await getPost(postId);
  if (!post) return;
  const today = new Date().toISOString().split('T')[0];
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = `Publicar: ${post.title}`;
  document.getElementById('modalBody').innerHTML = `
    <form id="publishForm" onsubmit="return submitPublish(event, '${postId}')">
      <div class="form-group"><label>Data</label><input type="date" id="publishDate" value="${post.scheduledDate||today}" required></div>
      <p style="font-size:0.85rem;color:var(--green-700);margin:12px 0;">✅ Vai para Medir.</p>
      <div class="form-actions"><button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button><button type="submit" class="btn-success">🚀 Publicar</button></div>
    </form>`;
  overlay.classList.remove('hidden');
}

async function submitPublish(event, postId) {
  event.preventDefault();
  const date = document.getElementById('publishDate').value;
  await publishPost(postId, date);
  closeModal();
  await updateCounts();
  navigateTo(currentView);
  return false;
}

async function openMetricsModal(postId) {
  const post = await getPost(postId);
  if (!post) return;
  const m = post.metrics || {};
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = `Métricas: ${post.title}`;
  document.getElementById('modalBody').innerHTML = `
    <form id="metricsForm" onsubmit="return submitMetrics(event, '${postId}')">
      <div class="form-row"><div class="form-group"><label>❤️ Curtidas</label><input type="number" id="metricLikes" value="${m.likes||0}" min="0"></div><div class="form-group"><label>💬 Comentários</label><input type="number" id="metricComments" value="${m.comments||0}" min="0"></div></div>
      <div class="form-row"><div class="form-group"><label>🔁 Compart.</label><input type="number" id="metricShares" value="${m.shares||0}" min="0"></div><div class="form-group"><label>👁️ Alcance</label><input type="number" id="metricReach" value="${m.reach||0}" min="0"></div></div>
      <div class="form-group"><label>💾 Salvos</label><input type="number" id="metricSaves" value="${m.saves||0}" min="0"></div>
      <div class="form-actions"><button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button><button type="submit" class="btn-primary">Salvar</button></div>
    </form>`;
  overlay.classList.remove('hidden');
}

async function submitMetrics(event, postId) {
  event.preventDefault();
  await updateMetrics(postId, {
    likes: parseInt(document.getElementById('metricLikes').value) || 0,
    comments: parseInt(document.getElementById('metricComments').value) || 0,
    shares: parseInt(document.getElementById('metricShares').value) || 0,
    reach: parseInt(document.getElementById('metricReach').value) || 0,
    saves: parseInt(document.getElementById('metricSaves').value) || 0
  });
  closeModal();
  navigateTo(currentView);
  return false;
}

async function advancePost(postId) {
  const post = await getPost(postId);
  if (!post) return;
  const stageIdx = STAGE_ORDER.indexOf(post.stage);
  if (stageIdx < STAGE_ORDER.length - 1) {
    const nextStage = STAGE_ORDER[stageIdx + 1];
    await movePost(postId, nextStage);
    await updateCounts();
    navigateTo(currentView);
  }
}

async function deleteContent(postId) {
  if (confirm('Excluir este conteúdo?')) {
    await deletePost(postId);
    await updateCounts();
    navigateTo(currentView);
  }
}

async function openSettings() {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = '⚙️ Configurações';
  const team = await getTeam();
  const isOnline = await api.checkConnection().catch(() => false);
  const token = api.getToken();

  document.getElementById('modalBody').innerHTML = `
    <div class="settings-section">
      <h3>🔐 ${isOnline ? (token ? '✅ Autenticado' : 'Autenticação') : '🔌 Servidor offline'}</h3>
      ${!isOnline ? '<p style="color:var(--text-secondary);font-size:0.85rem;">Servidor offline.</p>' : !token ? `
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px;">Conecte-se para sincronizar.</p>
        <div style="display:flex;gap:8px;">
          <button class="btn-primary" onclick="document.getElementById('modalTitle').textContent='🔐 Entrar';document.getElementById('modalBody').innerHTML=\`<form id='loginForm' onsubmit='return submitLogin(event)'><div class=form-group><label>Email</label><input type=email id=loginEmail required></div><div class=form-group><label>Senha</label><input type=password id=loginPassword required minlength=6></div><div id=loginError style='color:#EF4444;font-size:0.85rem;display:none;'></div><div class=form-actions><button type=button class=btn-secondary onclick=closeModal()>Cancelar</button><button type=submit class=btn-primary>Entrar</button></div></form>\`">Entrar</button>
          <button class="btn-secondary" onclick="document.getElementById('modalTitle').textContent='🔐 Criar Conta';document.getElementById('modalBody').innerHTML=\`<form id='registerForm' onsubmit='return submitRegister(event)'><div class=form-group><label>Nome</label><input type=text id=regName required></div><div class=form-group><label>Email</label><input type=email id=regEmail required></div><div class=form-group><label>Senha</label><input type=password id=regPassword required minlength=6></div><div id=regError style='color:#EF4444;font-size:0.85rem;display:none;'></div><div class=form-actions><button type=button class=btn-secondary onclick=closeModal()>Cancelar</button><button type=submit class=btn-primary>Criar</button></div></form>\`">Criar Conta</button>
        </div>` : '<button class="btn-secondary" onclick="api.logout();closeModal();showToast(\'Desconectado.\')">Sair</button>'}
    </div>
    <div class="settings-section">
      <h3>👥 Equipe</h3>
      <div class="settings-team">
        ${team.map(m => `<div class="team-member-row"><div class="team-member-role">${m.role}</div><div class="team-member-name"><input type="text" class="team-name-input" data-role="${escHtml(m.role)}" value="${escHtml(m.name||'')}"></div></div>`).join('')}
      </div>
    </div>
    <div class="form-actions">
      <button class="btn-secondary" onclick="closeModal()">Fechar</button>
      <button class="btn-primary" onclick="saveTeamSettings()">Salvar</button>
    </div>`;
  overlay.classList.remove('hidden');
}

async function saveTeamSettings() {
  const inputs = document.querySelectorAll('.team-name-input');
  for (const input of inputs) {
    const name = input.value.trim();
    if (name) await updateTeamMember(input.dataset.role, name);
  }
  closeModal();
  navigateTo(currentView);
}

async function submitLogin(event) {
  event.preventDefault();
  try { await api.login(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value); closeModal(); openSettings(); }
  catch (err) { const el = document.getElementById('loginError'); if (el) { el.style.display = 'block'; el.textContent = 'Erro: ' + err.message; } }
  return false;
}

async function submitRegister(event) {
  event.preventDefault();
  try { await api.register(document.getElementById('regName').value, document.getElementById('regEmail').value, document.getElementById('regPassword').value); closeModal(); openSettings(); }
  catch (err) { const el = document.getElementById('regError'); if (el) { el.style.display = 'block'; el.textContent = 'Erro: ' + err.message; } }
  return false;
}

function openEditModal(postId) { openPostModal(postId); }

function closeModal() { document.getElementById('modalOverlay').classList.add('hidden'); }

function toggleAiSection(header) {
  const body = header.nextElementSibling;
  const toggle = header.querySelector('.ai-toggle');
  body.style.display = body.style.display === 'none' ? 'block' : 'none';
  toggle.textContent = body.style.display === 'none' ? '▶' : '▼';
}

async function generateIdeasAction() {
  const topic = document.getElementById('aiTopic')?.value?.trim();
  const platform = document.getElementById('aiPlatform')?.value;
  const resultsDiv = document.getElementById('aiResults');
  const btn = document.getElementById('btnGenerateIdeas');
  if (!topic) { resultsDiv.innerHTML = '<p style="color:#EF4444;">Digite um tema.</p>'; return; }
  resultsDiv.innerHTML = '<p style="color:var(--text-secondary);">🤔 Gerando...</p>';
  if (btn) btn.disabled = true;

  try {
    const connected = await checkServer();
    let ideas;
    if (connected) {
      const resp = await api.generateIdeas(topic, platform);
      ideas = resp.ideas?.ideas || resp.ideas;
    }
    if (!ideas) {
      resultsDiv.innerHTML = `<div class="idea-result"><h4>📋 Ideias para "${topic}"</h4><div class="idea-card" onclick="createPostFromIdea('${escHtml(topic)}', '${platform}', 'Sobre ${escHtml(topic)}')"><strong>✍️ ${topic}</strong><p style="font-size:0.85rem;color:var(--text-secondary);">💡 Clique para criar post</p></div></div>`;
      if (btn) btn.disabled = false;
      return;
    }
    const ideasList = Array.isArray(ideas) ? ideas : (ideas.ideas || []);
    resultsDiv.innerHTML = `<div class="idea-result"><h4>💡 Ideias para "${topic}"</h4>${ideasList.map((idea, idx) => `
      <div class="idea-card" onclick="createPostFromIdea('${escHtml(idea.title || idea.topic || topic)}', '${platform}', '${escHtml(idea.description || '')}')">
        <strong>${escHtml(idea.title || idea.topic || `Ideia ${idx+1}`)}</strong>
        <span style="font-size:0.7rem;background:var(--bg);padding:2px 8px;border-radius:12px;float:right;">${idea.format || 'post'}</span>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin:4px 0;">${escHtml(idea.description || '')}</p>
      </div>`).join('')}</div>`;
  } catch (err) {
    resultsDiv.innerHTML = `<div class="idea-result"><h4>📋 Ideias para "${topic}"</h4><div class="idea-card" onclick="createPostFromIdea('${escHtml(topic)}', '${platform}', 'Sobre ${escHtml(topic)}')"><strong>✍️ ${topic}</strong></div><p style="font-size:0.75rem;color:var(--text-secondary);">Configure a chave Gemini.</p></div>`;
  }
  if (btn) btn.disabled = false;
}

async function createPostFromIdea(title, platform, description, hashtags = []) {
  await savePost({ title, description, platform, stage: 'pesquisar', hashtags: hashtags.length > 0 ? hashtags : ['#' + title.toLowerCase().replace(/\s+/g, '')], content: '', assignedTo: 'Ana Pesquisa' });
  await updateCounts();
  navigateTo('pesquisar');
  const el = document.getElementById('aiResults');
  if (el) el.innerHTML = '<p style="color:#10B981;">✅ Post criado!</p>';
}

async function generatePreviewAction() {
  const topic = document.getElementById('aiCreateTopic')?.value?.trim();
  const platform = document.getElementById('aiCreatePlatform')?.value;
  const pilar = document.getElementById('aiCreatePilar')?.value;
  const container = document.getElementById('previewContainer');
  if (!topic) { container.innerHTML = '<p style="color:#EF4444;font-size:0.85rem;">Digite um tema.</p>'; return; }

  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);"><p>🎨 Gerando conteúdo CachoViva...</p><div class="loading-spinner" style="margin:16px auto;width:32px;height:32px;border:3px solid var(--green-300);border-top-color:var(--green-700);border-radius:50%;animation:spin 0.8s linear infinite;"></div></div>';

  try {
    const connected = await checkServer();
    let previewData = null;
    let imageData = null;

    if (connected) {
      const resp = await api.post('/ai/generate-preview', { topic, platform, tone: 'cachoviva', options: { pilar: pilar || undefined } });
      previewData = resp.preview;
      imageData = resp.image;
    }

    if (!previewData) {
      previewData = fallbackPreview(topic, platform, pilar);
    }

    if (!imageData?.imageUrl) {
      const encoded = encodeURIComponent((previewData.imagePrompt || topic).replace(/[<>"'&]/g, '').substring(0, 400));
      imageData = { imageUrl: `https://image.pollinations.ai/prompt/${encoded}` };
    }

    renderPostPreview(container, previewData, imageData, topic, platform);
  } catch (err) {
    const fb = fallbackPreview(topic, platform, pilar);
    const encoded = encodeURIComponent(topic.replace(/[<>"'&]/g, '').substring(0, 400));
    renderPostPreview(container, fb, { imageUrl: `https://image.pollinations.ai/prompt/${encoded}` }, topic, platform);
  }
}

function fallbackPreview(topic, platform, pilar) {
  return {
    platform: platform || 'instagram',
    pilar: pilar || 'Educação que Vende',
    hook: `Sabe por que seu cacho precisa de ${topic}? A CachoViva explica. 👇`,
    caption: `✨ VOCÊ SABIA?\n\n${topic} — parece simples, mas faz toda a diferença no seu cacho.\n\nA CachoViva desenvolveu o kit completo com Creme Cachos Definidos + Day After Spray para você ter:\n✅ Definição duradoura\n✅ Anti-frizz o dia todo\n✅ Resultado de salão em casa\n\n👉 Qualidade de salão, preço que cabe no bolso.\n\n🚀 Salve este post e compartilhe com uma amiga cacheada!\n\n#CachoViva #CachosDefinidos #CabeloCacheado #TransicaoCapilar`,
    hashtags: ['#CachoViva', '#CachosDefinidos', '#CabeloCacheado', '#' + topic.replace(/\s+/g, ''), '#TransicaoCapilar'],
    cta: 'Salve para ver depois e compartilhe!',
    imagePrompt: `Mulher negra 25-35 anos cabelos cacheados 3B-3C, ${topic}, fundo nude #F0C8AA, iluminação natural, estúdio`,
    imageStyle: 'CachoViva brand style',
    productMentioned: 'Creme Cachos Definidos + Day After Spray',
    captionShort: `${topic} — a CachoViva explica tudo!`,
    captionLong: `✨ VOCÊ SABIA?\n\n${topic}\n\nA linha CachoViva tem a solução:\n• Creme Cachos Definidos: 2 dias de cacho\n• Day After Spray: definição instantânea\n\nQualidade de salão, preço que cabe no bolso.\n\n#CachoViva`,
    onScreenText: platform === 'tiktok' ? `${topic} | CachoViva` : null,
    format: 'post'
  };
}

function renderPostPreview(container, preview, image, topic, platform) {
  const imgUrl = image?.imageUrl || '';
  const caption = preview.caption || preview.captionLong || '';
  const hashtags = preview.hashtags || [];
  const hook = preview.hook || '';
  const cta = preview.cta || '';
  const product = preview.productMentioned || '';
  const onScreenText = preview.onScreenText || '';

  const isTikTok = platform === 'tiktok';
  const isInstagram = platform === 'instagram';
  const isYouTube = platform === 'youtube';

  let mockupHtml = '';

  if (isTikTok) {
    mockupHtml = `
      <div class="mockup-tiktok">
        <div class="mockup-tiktok-header">
          <span class="mockup-user">@cachoviva</span>
          <span class="mockup-dots">•••</span>
        </div>
        <div class="mockup-tiktok-video" style="background:linear-gradient(135deg,#6B331E,#3A5020);">
          <div class="mockup-tiktok-overlay">${escHtml(onScreenText)}</div>
          <div class="mockup-tiktok-brand">✦ CachoViva</div>
          ${imgUrl ? `<img src="${imgUrl}" alt="" class="mockup-tiktok-bg">` : ''}
        </div>
        <div class="mockup-tiktok-caption">
          <strong>@cachoviva</strong> ${escHtml(caption)}
        </div>
        <div class="mockup-tiktok-hashtags">${hashtags.map(h => escHtml(h)).join(' ')}</div>
      </div>`;
  } else if (isInstagram) {
    mockupHtml = `
      <div class="mockup-instagram">
        <div class="mockup-ig-header">
          <div class="mockup-ig-user">
            <div class="mockup-ig-avatar">✦</div>
            <span><strong>cachoviva</strong> <span style="color:var(--text-secondary);font-size:0.75rem;">• Sponsored</span></span>
          </div>
          <span>•••</span>
        </div>
        <div class="mockup-ig-image" style="background:linear-gradient(135deg,#F0C8AA,#B8A060);">
          ${imgUrl ? `<img src="${imgUrl}" alt="">` : `<div class="mockup-ig-placeholder">✦</div>`}
          ${product ? `<div class="mockup-ig-product">🛒 ${escHtml(product)}</div>` : ''}
        </div>
        <div class="mockup-ig-actions">
          <span>❤️ 🤣 📩</span>
          <span>💾</span>
        </div>
        <div class="mockup-ig-likes"><strong>234 curtidas</strong></div>
        <div class="mockup-ig-caption">
          <strong>cachoviva</strong> ${escHtml(caption)}
        </div>
        <div class="mockup-ig-hashtags">${hashtags.map(h => escHtml(h)).join(' ')}</div>
        <div class="mockup-ig-comments">Ver todos os 12 comentários</div>
      </div>`;
  } else if (isYouTube) {
    mockupHtml = `
      <div class="mockup-youtube">
        <div class="mockup-yt-thumb" style="background:linear-gradient(135deg,#3A5020,#6B331E);">
          ${imgUrl ? `<img src="${imgUrl}" alt="">` : ''}
          <div class="mockup-yt-overlay">▶</div>
        </div>
        <div class="mockup-yt-info">
          <div class="mockup-yt-avatar">✦</div>
          <div class="mockup-yt-text">
            <div class="mockup-yt-title">${escHtml(topic)} | CachoViva</div>
            <div class="mockup-yt-meta">CachoViva • 2,1 mil visualizações • há 3 horas</div>
            <div class="mockup-yt-desc">${escHtml(caption.substring(0, 200))}</div>
          </div>
        </div>
      </div>`;
  } else {
    mockupHtml = `
      <div class="mockup-instagram">
        <div class="mockup-ig-header">
          <div class="mockup-ig-user">
            <div class="mockup-ig-avatar">✦</div>
            <span><strong>cachoviva</strong></span>
          </div>
          <span>•••</span>
        </div>
        <div class="mockup-ig-image" style="background:linear-gradient(135deg,#F0C8AA,#B8A060);">
          ${imgUrl ? `<img src="${imgUrl}" alt="">` : `<div class="mockup-ig-placeholder">✦</div>`}
        </div>
        <div class="mockup-ig-actions">
          <span>❤️ 💬 📩</span>
          <span>💾</span>
        </div>
        <div class="mockup-ig-caption">
          <strong>cachoviva</strong> ${escHtml(caption)}
        </div>
        <div class="mockup-ig-hashtags">${hashtags.map(h => escHtml(h)).join(' ')}</div>
      </div>`;
  }

  container.innerHTML = `
    <div class="preview-wrapper">
      <div class="preview-header">
        <div class="preview-header-left">
          <span class="preview-pilar">${preview.pilar || 'Conteúdo'}</span>
          <span class="preview-hook">🎯 ${escHtml(hook)}</span>
        </div>
        <div class="preview-header-right">
          <span class="preview-platform-badge ${platform}">${getPlatformLabel(platform)}</span>
        </div>
      </div>
      <div class="preview-content">
        ${mockupHtml}
      </div>
      <div class="preview-details">
        <div class="preview-detail-section">
          <div class="preview-detail-label">📝 Legenda (texto completo)</div>
          <div class="preview-detail-text" style="white-space:pre-wrap;">${escHtml(caption)}</div>
        </div>
        <div class="preview-detail-section">
          <div class="preview-detail-label">🏷️ Hashtags</div>
          <div class="preview-detail-hashtags">${hashtags.map(h => `<span class="preview-hashtag">${escHtml(h)}</span>`).join('')}</div>
        </div>
        <div class="preview-detail-section">
          <div class="preview-detail-label">📢 CTA</div>
          <div class="preview-detail-text">${escHtml(cta)}</div>
        </div>
        ${product ? `<div class="preview-detail-section"><div class="preview-detail-label">🛍️ Produto Mencionado</div><div class="preview-detail-text">${escHtml(product)}</div></div>` : ''}
        ${isTikTok && onScreenText ? `<div class="preview-detail-section"><div class="preview-detail-label">💬 Texto na Tela</div><div class="preview-detail-text">${escHtml(onScreenText)}</div></div>` : ''}
      </div>
      <div class="preview-actions">
        <button class="btn-primary" onclick="createPostFromPreview('${escHtml(topic)}', '${platform}')">📝 Criar Post</button>
        <button class="btn-secondary" onclick="copyPreviewText()">📋 Copiar Legenda</button>
        <button class="btn-secondary" onclick="regeneratePreview()">🔄 Regenerar</button>
      </div>
    </div>`;

  container.dataset.previewCaption = caption;
  container.dataset.previewHashtags = hashtags.join(' ');
  container.dataset.previewTopic = topic;
  container.dataset.previewPlatform = platform;
  container.dataset.previewImage = imgUrl;
  container.dataset.previewHook = hook;
  container.dataset.previewCta = cta;
  container.dataset.previewProduct = product;
}

async function createPostFromPreview(topic, platform) {
  const container = document.getElementById('previewContainer');
  const caption = container?.dataset?.previewCaption || '';
  const hashtags = (container?.dataset?.previewHashtags || '').split(' ').filter(Boolean);
  const imageUrl = container?.dataset?.previewImage || '';
  const hook = container?.dataset?.previewHook || '';
  const cta = container?.dataset?.previewCta || '';
  const product = container?.dataset?.previewProduct || '';

  const contentObj = { caption, hashtags, image: imageUrl, hook, cta, product, generatedBy: 'cachoviva-ai', createdAt: Date.now() };

  await savePost({
    title: topic,
    description: hook || caption.substring(0, 120),
    platform: platform || 'instagram',
    stage: 'criar',
    hashtags: hashtags,
    content: JSON.stringify(contentObj),
    assignedTo: 'Carla Cria'
  });
  await updateCounts();
  navigateTo('criar');
  container.innerHTML = '<div style="text-align:center;padding:20px;color:#10B981;font-weight:600;">✅ Post criado com sucesso!</div>';
}

function copyPreviewText() {
  const container = document.getElementById('previewContainer');
  const caption = container?.dataset?.previewCaption || '';
  const hashtags = container?.dataset?.previewHashtags || '';
  const text = caption + '\n\n' + hashtags;
  navigator.clipboard.writeText(text).then(() => showToast('📋 Legenda copiada!'));
}

function regeneratePreview() {
  const topic = document.getElementById('aiCreateTopic')?.value?.trim();
  if (topic) generatePreviewAction();
}

async function markReadyForApproval(postId) {
  const post = await getPost(postId);
  if (!post || post.stage !== 'criar') return;
  const member = await getTeam().then(t => t.find(m => m.stage === 'aprovar'));
  post.stage = 'aprovar';
  post.assignedTo = member?.name || 'Fábio Aprova';
  post.updatedAt = Date.now();
  await savePost(post);
  updateCounts();
  navigateTo('aprovar');
  showToast('✅ Conteúdo foi para Aprovar.');
}

async function approveAndPublish(postId) {
  const post = await getPost(postId);
  if (!post || post.stage !== 'aprovar') return;
  const today = new Date().toISOString().split('T')[0];
  await publishPost(postId, today);
  updateCounts();
  navigateTo('medir');
  showToast('🚀 Publicado!');
}

function copyText(btn) {
  const text = btn.closest('.idea-result')?.querySelector('[style*="white-space:pre-wrap"]')?.textContent;
  if (text) {
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = '✅ Copiado!';
      setTimeout(() => { btn.textContent = '📋 Copiar'; }, 2000);
    });
  }
}

function downloadImage(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.toLowerCase().replace(/\s+/g, '-')}.png`;
  a.click();
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// === BRIEFING / SUGGESTIONS ===

async function loadBriefingDisplay() {
  const container = document.getElementById('briefingDisplay');
  if (!container) return;
  try {
    const resp = await api.getActiveBriefing().catch(() => getActiveBriefing());
    const briefing = resp?.briefing || resp?.success?.briefing || null;
    if (briefing) {
      container.innerHTML = `<div style="background:var(--bg);border-radius:var(--radius-sm);padding:12px;border-left:3px solid var(--green-500);margin-bottom:8px;">
        <p style="font-size:0.85rem;white-space:pre-wrap;margin:0;">${escHtml(briefing.content)}</p>
        <p style="font-size:0.7rem;color:var(--text-secondary);margin-top:6px;">📌 ${briefing.platform_focus || 'instagram'} | ${new Date((briefing.created_at||0)*1000 || briefing.created_at).toLocaleDateString('pt-BR')}</p>
        <button class="btn-secondary btn-sm" onclick="openBriefingEditor()">✏️</button></div>`;
    } else {
      container.innerHTML = `<div style="background:rgba(245,158,11,0.1);border-radius:var(--radius-sm);padding:12px;border-left:3px solid #F59E0B;"><p style="font-size:0.85rem;margin:0;">Nenhum briefing ativo.</p></div>
        <button class="btn-primary btn-sm" onclick="openBriefingEditor()" style="margin-top:8px;">📋 Definir Briefing</button>`;
    }
  } catch {
    container.innerHTML = `<button class="btn-primary btn-sm" onclick="openBriefingEditor()">📋 Definir Briefing</button>`;
  }
}

function openBriefingEditor() {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = '📋 Briefing';
  document.getElementById('modalBody').innerHTML = `
    <form id="briefingForm" onsubmit="return saveBriefingForm(event)">
      <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px;">Briefing usado pela IA para pesquisar e sugerir conteúdo.</p>
      <div class="form-group"><label>Briefing</label><textarea id="briefingContent" rows="6" placeholder="Ex: Marca de cosméticos para cabelos cacheados..."></textarea></div>
      <div class="form-group"><label>Foco</label><select id="briefingPlatform"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option></select></div>
      <div class="form-actions"><button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button><button type="submit" class="btn-primary">Salvar</button></div>
    </form>`;
  overlay.classList.remove('hidden');
  api.getActiveBriefing().then(resp => {
    const b = resp?.briefing;
    if (b) {
      if (document.getElementById('briefingContent')) document.getElementById('briefingContent').value = b.content || '';
      if (b.platform_focus && document.getElementById('briefingPlatform')) document.getElementById('briefingPlatform').value = b.platform_focus;
    }
  }).catch(() => {});
}

async function saveBriefingForm(event) {
  event.preventDefault();
  const content = document.getElementById('briefingContent').value.trim();
  const platformFocus = document.getElementById('briefingPlatform').value;
  if (!content) return false;
  try { await api.saveBriefing(content, platformFocus); } catch { await saveBriefing(content, platformFocus); }
  closeModal();
  loadBriefingDisplay();
  return false;
}

async function loadSuggestions() {
  const container = document.getElementById('suggestionsList');
  if (!container) return;
  try {
    const resp = await api.getSuggestions('pending').catch(() => getSuggestions('pending'));
    const suggestions = resp?.suggestions || [];
    if (!suggestions.length) {
      container.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem;">Nenhuma sugestão pendente.</p>';
      return;
    }
    container.innerHTML = suggestions.map(s => {
      const hashtags = s.hashtags || [];
      let contentGen = {};
      try { contentGen = typeof s.content_generated === 'string' ? JSON.parse(s.content_generated) : (s.content_generated || {}); } catch {}
      return `<div class="suggestion-card">
        <div class="suggestion-header"><strong>${escHtml(s.title)}</strong><span class="post-platform ${s.platform}">${getPlatformLabel(s.platform)}</span></div>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin:6px 0;">${escHtml(s.description || '')}</p>
        ${hashtags.length ? `<div style="font-size:0.75rem;color:var(--green-700);margin-bottom:4px;">${hashtags.map(h => escHtml(h)).join(' ')}</div>` : ''}
        <div style="display:flex;gap:8px;">
          <button class="btn-success btn-sm" onclick="approveSuggestionAction('${s.id}')">👍 Aprovar</button>
          <button class="btn-danger btn-sm" onclick="rejectSuggestionAction('${s.id}')">✕ Rejeitar</button>
        </div>
      </div>`;
    }).join('');
  } catch {
    container.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem;">Erro ao carregar.</p>';
  }
}

async function approveSuggestionAction(id) {
  try {
    const resp = await api.approveSuggestion(id).catch(() => approveSuggestion(id));
    if (resp?.success) { loadSuggestions(); updateCounts(); showToast('✅ Conteúdo criado!'); }
    else showToast('❌ Erro ao aprovar.');
  } catch (err) { showToast('❌ ' + (err.message || 'Erro')); }
}

async function rejectSuggestionAction(id) {
  try { await api.rejectSuggestion(id); } catch {}
  loadSuggestions();
}

async function triggerResearchNow() {
  const btn = document.querySelector('[onclick="triggerResearchNow()"]');
  if (btn) btn.disabled = true;
  try {
    await api.triggerResearch('manual');
    showToast('✅ Pesquisa concluída!');
    loadSuggestions();
  } catch (err) { showToast('❌ ' + (err.message || 'Servidor offline')); }
  if (btn) btn.disabled = false;
}

function openKeywordsManager() {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = '🔑 Palavras-chave';
  document.getElementById('modalBody').innerHTML = `
    <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px;">Usadas nas pesquisas agendadas com IA.</p>
    <div id="keywordsList"><p style="color:var(--text-secondary);">Carregando...</p></div>
    <div style="margin-top:12px;display:flex;gap:8px;"><input type="text" id="newKeywordInput" placeholder="Nova keyword" style="flex:1;"><button class="btn-primary btn-sm" onclick="addKeywordAction()">+</button></div>
    <div class="form-actions"><button class="btn-secondary" onclick="closeModal()">Fechar</button></div>`;
  overlay.classList.remove('hidden');
  loadKeywordsList();
}

async function loadKeywordsList() {
  const container = document.getElementById('keywordsList');
  if (!container) return;
  try {
    const resp = await api.getKeywords();
    const keywords = resp?.keywords || [];
    container.innerHTML = keywords.length ? keywords.map(k => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--bg);border-radius:var(--radius-sm);margin-bottom:4px;">
        <span><strong>${escHtml(k.keyword)}</strong> <span style="font-size:0.75rem;color:var(--text-secondary);">${k.active ? '🟢' : '🔴'}</span></span>
        <div style="display:flex;gap:4px;">
          <button class="btn-icon" onclick="toggleKeyword('${k.id}', ${k.active ? 0 : 1})">${k.active ? '⏸️' : '▶️'}</button>
          <button class="btn-icon" onclick="deleteKeywordAction('${k.id}')" style="color:#EF4444;">🗑️</button>
        </div>
      </div>`).join('') : '<p style="color:var(--text-secondary);">Nenhuma keyword.</p>';
  } catch { container.innerHTML = '<p style="color:var(--text-secondary);">Erro ao carregar.</p>'; }
}

async function addKeywordAction() {
  const input = document.getElementById('newKeywordInput');
  const keyword = input?.value?.trim();
  if (!keyword) return;
  try { await api.addKeyword(keyword); input.value = ''; loadKeywordsList(); }
  catch (err) { showToast('❌ ' + err.message); }
}

async function toggleKeyword(id, active) {
  try { await api.updateKeyword(id, { active }); loadKeywordsList(); } catch {}
}

async function deleteKeywordAction(id) {
  try { await api.deleteKeyword(id); loadKeywordsList(); } catch {}
}

function showToast(message) {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--bg-card);color:var(--text);padding:12px 20px;border-radius:var(--radius-sm);box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:9999;font-size:0.9rem;border-left:3px solid var(--green-500);animation:fadeIn 0.3s ease;';
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s ease'; setTimeout(() => toast.remove(), 300); }, 4000);
}
