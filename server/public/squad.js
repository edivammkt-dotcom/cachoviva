const API = '/api/squad';

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadDashboard();
  loadPendingPosts();
  loadHistory(0);
  loadPublished();

  document.getElementById('runPipelineBtn').addEventListener('click', runPipeline);
  document.getElementById('configForm').addEventListener('submit', saveConfig);
  document.getElementById('briefingForm').addEventListener('submit', saveBriefing);

  document.getElementById('historySearch').addEventListener('input', debounce(() => loadHistory(0), 300));
  document.getElementById('historyStageFilter').addEventListener('change', () => loadHistory(0));
});

function initTabs() {
  document.querySelectorAll('.squad-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.squad-nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

async function loadDashboard() {
  try {
    const resp = await fetch(API + '/status');
    const data = await resp.json();
    document.getElementById('briefingText').textContent = data.briefing?.content?.substring(0, 40) || '—';
    document.getElementById('keywordsCount').textContent = data.keywords?.length || 0;
    document.getElementById('pendingCount').textContent = data.pendingApproval?.length || 0;
    document.getElementById('cycleInterval').textContent = data.config?.auto_interval || 'A cada 2 dias';

    const logs = data.logs || [];
    const logsList = document.getElementById('logsList');
    if (logs.length === 0) {
      logsList.innerHTML = '<p class="empty-state">Nenhum log disponível.</p>';
    } else {
      logsList.innerHTML = logs.map(log => {
        const time = new Date((log.created_at || 0) * 1000).toLocaleString('pt-BR');
        return `<div class="log-item">
          <span class="log-time">${time}</span>
          <span class="log-action">${log.action || ''}</span>
          <span class="log-details">${(log.details || '').substring(0, 120)}</span>
        </div>`;
      }).join('');
    }
  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
  }
}

async function loadPendingPosts() {
  try {
    const resp = await fetch(API + '/status');
    const data = await resp.json();
    const posts = data.pendingApproval || [];
    const list = document.getElementById('pendingList');
    if (posts.length === 0) {
      list.innerHTML = '<p class="empty-state">Nenhum post aguardando aprovação.</p>';
      return;
    }
    list.innerHTML = posts.map(p => {
      const content = (() => { try { return JSON.parse(p.content || '{}'); } catch { return {}; } })();
      const images = content.media?.images || [];
      const imageHtml = images.length > 0
        ? `<div class="pending-images">${images.slice(0, 3).map(img =>
            `<img src="${img.url || img.imageUrl}" alt="Preview" class="pending-img"
              onerror="this.style.display='none'">`
          ).join('')}</div>`
        : '';
      return `<div class="pending-card">
        <h4>${p.title}</h4>
        <div class="pending-meta">📱 ${p.platform} | 🎯 ${content.format || p.stage}</div>
        ${imageHtml}
        <div class="pending-preview">${(content.copy || p.description || '').substring(0, 200)}</div>
        <div class="pending-actions">
          <button class="btn-sm approve" onclick="approvePost('${p.id}')">✅ Aprovar</button>
          <button class="btn-sm reject" onclick="rejectPost('${p.id}')">❌ Rejeitar</button>
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    console.error('Erro ao carregar pendentes:', err);
  }
}

async function loadHistory(page) {
  try {
    const search = document.getElementById('historySearch').value;
    const stage = document.getElementById('historyStageFilter').value;
    let url = API + '/history?page=' + page + '&limit=20';
    if (search) url += '&search=' + encodeURIComponent(search);
    if (stage) url += '&stage=' + encodeURIComponent(stage);
    const resp = await fetch(url);
    const data = await resp.json();
    const posts = data.posts || [];
    const list = document.getElementById('historyList');
    if (posts.length === 0) {
      list.innerHTML = '<p class="empty-state">Nenhum post encontrado.</p>';
      return;
    }
    list.innerHTML = posts.map(p => {
      const stageEmoji = { approved: '✅', rejected: '❌', pending_approval: '⏳', draft: '📝', publicar: '🚀' };
      const time = new Date((p.created_at || 0) * 1000).toLocaleString('pt-BR');
      return `<div class="history-card">
        <h4>${stageEmoji[p.stage] || '📄'} ${p.title}</h4>
        <div class="history-meta">📱 ${p.platform} | ${stageEmoji[p.stage] || ''} ${p.stage} | 🕐 ${time}</div>
      </div>`;
    }).join('');
    const totalPages = Math.ceil((data.total || 0) / 20);
    renderPagination(page, totalPages);
  } catch (err) {
    console.error('Erro ao carregar histórico:', err);
  }
}

function renderPagination(current, total) {
  const el = document.getElementById('historyPagination');
  if (total <= 1) { el.innerHTML = ''; return; }
  let html = '';
  if (current > 0) html += `<button onclick="loadHistory(${current - 1})">◀</button>`;
  for (let i = 0; i < total && i < 7; i++) {
    html += `<button class="${i === current ? 'active' : ''}" onclick="loadHistory(${i})">${i + 1}</button>`;
  }
  if (current < total - 1) html += `<button onclick="loadHistory(${current + 1})">▶</button>`;
  el.innerHTML = html;
}

async function runPipeline() {
  const btn = document.getElementById('runPipelineBtn');
  const status = document.getElementById('pipelineStatus');
  btn.disabled = true;
  status.textContent = '⏳ Executando pipeline...';
  status.className = 'pipeline-status loading';
  try {
    const resp = await fetch(API + '/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await resp.json();
    if (data.success) {
      const approved = (data.posts || []).filter(p => p.stage === 'pending_approval').length;
      status.textContent = `✅ ${data.posts?.length || 0} posts gerados (${approved} aguardando aprovação) em ${data.elapsed || '?'}s`;
      status.className = 'pipeline-status';
      loadDashboard();
      loadPendingPosts();
    } else {
      status.textContent = '❌ ' + (data.error || 'Erro desconhecido');
      status.className = 'pipeline-status';
    }
  } catch (err) {
    status.textContent = '❌ Erro de conexão: ' + err.message;
    status.className = 'pipeline-status';
  }
  btn.disabled = false;
}

async function approvePost(id) {
  try {
    await fetch(API + '/approve/' + id, { method: 'POST' });
    loadPendingPosts();
    loadDashboard();
  } catch (err) {
    alert('Erro ao aprovar: ' + err.message);
  }
}

async function rejectPost(id) {
  try {
    await fetch(API + '/reject/' + id, { method: 'POST' });
    loadPendingPosts();
    loadDashboard();
  } catch (err) {
    alert('Erro ao rejeitar: ' + err.message);
  }
}

async function saveConfig(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    autoInterval: form.autoInterval.value,
    maxPostsPerCycle: parseInt(form.maxPostsPerCycle.value) || 3
  };
  try {
    const resp = await fetch(API + '/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await resp.json();
    if (result.success) {
      alert('✅ Configuração salva!');
      loadDashboard();
    }
  } catch (err) {
    alert('Erro: ' + err.message);
  }
}

async function loadPublished() {
  try {
    const resp = await fetch(API + '/approved');
    const data = await resp.json();
    const posts = data.posts || [];
    const list = document.getElementById('publishedList');
    if (posts.length === 0) {
      list.innerHTML = '<p class="empty-state">Nenhum post aprovado. Vá em "Aprovação" e aprove algum post.</p>';
      return;
    }
    list.innerHTML = posts.map(p => {
      const c = p.content || {};
      const images = c.media?.images || [];
      const isPublished = p.stage === 'published';
      const imagesHtml = images.map((img, i) =>
        `<div class="pub-img-wrapper">
          <img src="${img.url || img.imageUrl}" alt="Imagem ${i+1}" class="pub-img"
            onerror="this.outerHTML='<span class=\\'pub-img-error\\'>Erro ao carregar</span>'">
          <div class="pub-img-actions">
            <button class="btn-xs" onclick="downloadImage('${img.url || img.imageUrl}', '${p.id}_img${i}')">⬇ Baixar</button>
          </div>
        </div>`
      ).join('') || '<span class="pub-noimg">Sem imagens</span>';
      const hashtags = Array.isArray(c.hashtags) ? c.hashtags.join(' ') : '';
      return `<div class="pub-card ${isPublished ? 'published' : ''}">
        <div class="pub-header">
          <h4>${p.title}</h4>
          <span class="pub-platform">📱 ${p.platform}</span>
          <span class="pub-stage">${isPublished ? '✅ Publicado' : '⏳ Aprovado'}</span>
        </div>
        <div class="pub-body">
          <div class="pub-images">${imagesHtml}</div>
          <div class="pub-text">
            <button class="btn-xs" onclick="copyText('${encodeURIComponent(c.copy || p.description || '')}', 'copy_${p.id}')">📋 Copiar Texto</button>
            <span id="copy_${p.id}" class="copy-feedback"></span>
            ${hashtags ? `<button class="btn-xs" onclick="copyText('${encodeURIComponent(hashtags)}', 'hash_${p.id}')">📋 Copiar Hashtags</button>` : ''}
            <span id="hash_${p.id}" class="copy-feedback"></span>
          </div>
        </div>
        <div class="pub-footer">
          ${c.videoScript ? `<details><summary>🎬 Roteiro</summary><pre>${c.videoScript}</pre></details>` : ''}
          ${!isPublished ? `<button class="btn-sm approve" onclick="publishPost('${p.id}')">🚀 Publicar</button>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    console.error('Erro ao carregar aprovados:', err);
  }
}

function downloadImage(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename + '.jpg';
  a.click();
}

function copyText(encodedText, elId) {
  const text = decodeURIComponent(encodedText);
  navigator.clipboard.writeText(text).then(() => {
    const el = document.getElementById(elId);
    if (el) { el.textContent = '✅ Copiado!'; setTimeout(() => el.textContent = '', 2000); }
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    const el = document.getElementById(elId);
    if (el) { el.textContent = '✅ Copiado!'; setTimeout(() => el.textContent = '', 2000); }
  });
}

async function publishPost(id) {
  try {
    const resp = await fetch(API + '/publish/' + id, { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      loadPublished();
      loadDashboard();
    }
  } catch (err) {
    alert('Erro ao publicar: ' + err.message);
  }
}

async function saveBriefing(e) {
  e.preventDefault();
  const text = document.getElementById('briefingInput').value;
  if (!text.trim()) { alert('Digite um briefing'); return; }
  try {
    const resp = await fetch(API + '/briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await resp.json();
    if (data.success) {
      alert('✅ Briefing salvo! O pipeline vai usar ele na próxima execução.');
      document.getElementById('briefingInput').value = '';
      loadDashboard();
    }
  } catch (err) {
    alert('Erro: ' + err.message);
  }
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
