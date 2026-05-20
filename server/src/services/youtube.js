const axios = require('axios');
const { getDb } = require('../database');

const YT_API = 'https://www.googleapis.com/youtube/v3';

async function publishPost(post, account) {
  try {
    if (!account?.access_token) {
      return { success: false, error: 'Conta do YouTube não conectada' };
    }
    const result = await uploadVideo(post, account.access_token);
    return { success: true, data: result };
  } catch (err) {
    console.error('YouTube publish error:', err);
    return { success: false, error: err.message };
  }
}

async function uploadVideo(post, accessToken) {
  const snippet = {
    snippet: {
      title: post.title,
      description: `${post.description || ''}\n\n${(post.hashtags || []).map(h => h.replace('#', '')).join(' ')}`,
      tags: (post.hashtags || []).filter(h => h.startsWith('#')).map(h => h.replace('#', '')),
      categoryId: '22'
    },
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false
    }
  };
  const resp = await axios.post(`${YT_API}/videos?part=snippet,status`, snippet, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Length': post.videoSize || 0,
      'X-Upload-Content-Type': 'video/*'
    }
  });
  return resp.data;
}

async function getMetrics(post, account) {
  try {
    if (!account?.access_token) {
      return null;
    }
    const resp = await axios.get(`${YT_API}/videos`, {
      params: {
        part: 'statistics',
        id: post.platform_id
      },
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const stats = resp.data.items?.[0]?.statistics;
    if (!stats) return null;
    return {
      likes: parseInt(stats.likeCount || '0'),
      comments: parseInt(stats.commentCount || '0'),
      shares: 0,
      reach: parseInt(stats.viewCount || '0'),
      saves: 0
    };
  } catch (err) {
    console.error('YouTube metrics error:', err);
    return null;
  }
}

module.exports = { publishPost, getMetrics };
