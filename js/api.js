const API_BASE = 'http://localhost:3001/api';

let apiToken = localStorage.getItem('cachoviva_token') || null;

const api = {
  setToken(token) {
    apiToken = token;
    if (token) {
      localStorage.setItem('cachoviva_token', token);
    } else {
      localStorage.removeItem('cachoviva_token');
    }
  },

  getToken() { return apiToken; },

  isConnected() { return !!apiToken; },

  async request(method, path, data = null) {
    const url = `${API_BASE}${path}`;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (apiToken) {
      options.headers['Authorization'] = `Bearer ${apiToken}`;
    }
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }
    try {
      const resp = await fetch(url, options);
      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(json.error || `Erro ${resp.status}`);
      }
      return json;
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error('Servidor offline');
      }
      throw err;
    }
  },

  get(path) { return this.request('GET', path); },
  post(path, data) { return this.request('POST', path, data); },
  put(path, data) { return this.request('PUT', path, data); },
  del(path) { return this.request('DELETE', path); },

  async checkConnection() {
    try {
      await this.get('/health');
      return true;
    } catch {
      return false;
    }
  },

  async login(email, password) {
    const resp = await this.post('/auth/login', { email, password });
    this.setToken(resp.token);
    return resp;
  },

  async register(name, email, password) {
    const resp = await this.post('/auth/register', { name, email, password });
    this.setToken(resp.token);
    return resp;
  },

  logout() {
    this.setToken(null);
  },

  async getPosts(stage = null) {
    const query = stage ? `?stage=${stage}` : '';
    return this.get(`/posts${query}`);
  },

  async getPost(id) {
    return this.get(`/posts/${id}`);
  },

  async savePost(postData) {
    if (postData.id) {
      return this.put(`/posts/${postData.id}`, postData);
    }
    return this.post('/posts', postData);
  },

  async deletePost(id) {
    return this.del(`/posts/${id}`);
  },

  async advancePost(id) {
    return this.post(`/posts/${id}/advance`);
  },

  async sendFeedback(id, text) {
    return this.post(`/posts/${id}/feedback`, { text });
  },

  async publishPost(id, date) {
    return this.post(`/posts/${id}/publish`, { date });
  },

  async updateMetrics(id, metrics) {
    return this.post(`/posts/${id}/metrics`, metrics);
  },

  async getCounts() {
    return this.get('/posts/counts/by-stage');
  },

  async getActivity() {
    return this.get('/posts/activity/recent');
  },

  async getTeam() {
    return this.get('/team');
  },

  async updateTeamMember(role, name) {
    return this.put(`/team/${encodeURIComponent(role)}`, { name });
  },

  async getSocialAccounts() {
    return this.get('/social/accounts');
  },

  async disconnectSocial(id) {
    return this.del(`/social/accounts/${id}`);
  },

  getSocialAuthUrl(platform) {
    return `${API_BASE}/social/${platform}/auth-url?token=${apiToken || ''}`;
  },

  // === AI GENERATION ===
  async generateIdeas(topic, platform, audience = 'geral') {
    return this.post('/ai/generate-ideas', { topic, platform, audience });
  },

  async generateContent(topic, platform, options = {}) {
    return this.post('/ai/generate-content', { topic, platform, options });
  },

  async generateText(title, description, platform, tone = 'profissional') {
    return this.post('/ai/generate-text', { title, description, platform, tone });
  },

  async generateImage(prompt, style = 'professional') {
    return this.post('/ai/generate-image', { prompt, style });
  },

  async generateCarousel(topic, options = {}) {
    return this.post('/ai/generate-carousel', { topic, options });
  },

  async generateVideo(topic, options = {}) {
    return this.post('/ai/generate-video', { topic, options });
  },

  async generateInsights(posts) {
    return this.post('/ai/generate-insights', { posts });
  },

  async getGeneratedContent(type = null, platform = null, limit = 50) {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (platform) params.set('platform', platform);
    params.set('limit', limit);
    return this.get(`/ai/generated-content?${params.toString()}`);
  },

  async createPostFromGenerated(contentId, title, platform, stage = 'criar') {
    return this.post('/ai/create-post-from-generated', { contentId, title, platform, stage });
  },

  // === RESEARCH / BRIEFING / AUTOMATION ===
  async getActiveBriefing() {
    return this.get('/research/briefings/active');
  },

  async getBriefings() {
    return this.get('/research/briefings');
  },

  async saveBriefing(content, platformFocus = 'instagram') {
    return this.post('/research/briefings', { content, platform_focus: platformFocus });
  },

  async updateBriefing(id, data) {
    return this.put(`/research/briefings/${id}`, data);
  },

  async deleteBriefing(id) {
    return this.del(`/research/briefings/${id}`);
  },

  async getKeywords() {
    return this.get('/research/keywords');
  },

  async addKeyword(keyword, scheduleCron = '0 8,14 * * 1-5') {
    return this.post('/research/keywords', { keyword, schedule_cron: scheduleCron });
  },

  async updateKeyword(id, data) {
    return this.put(`/research/keywords/${id}`, data);
  },

  async deleteKeyword(id) {
    return this.del(`/research/keywords/${id}`);
  },

  async getSuggestions(status = null) {
    const query = status ? `?status=${status}` : '';
    return this.get(`/research/suggestions${query}`);
  },

  async approveSuggestion(id) {
    return this.post(`/research/suggestions/${id}/approve`);
  },

  async rejectSuggestion(id) {
    return this.post(`/research/suggestions/${id}/reject`);
  },

  async triggerResearch(keyword) {
    return this.post('/research/trigger', { keyword });
  },

  async getTelegramConfig() {
    return this.get('/research/telegram/config');
  },

  async saveTelegramConfig(botToken, chatId = '') {
    return this.post('/research/telegram/config', { bot_token: botToken, chat_id: chatId });
  },

  async deleteTelegramConfig() {
    return this.del('/research/telegram/config');
  },

  async getTelegramMessages() {
    return this.get('/research/telegram/messages');
  },

  // === GOOGLE ANALYTICS ===
  async getGA4Metrics() {
    return this.get('/analytics/ga4');
  },

  async getGA4Status() {
    return this.get('/analytics/ga4/status');
  }
};
