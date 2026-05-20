const axios = require('axios');
const { getDb } = require('../database');

const GRAPH_API = 'https://graph.facebook.com/v18.0';

async function publishPost(post, account) {
  try {
    if (!account?.access_token) {
      return { success: false, error: 'Conta do Instagram não conectada' };
    }
    const container = await createContainer(post, account.access_token, account.account_id);
    if (!container?.id) {
      return { success: false, error: 'Falha ao criar container' };
    }
    const result = await publishContainer(container.id, account.access_token, account.account_id);
    return { success: true, data: result };
  } catch (err) {
    console.error('Instagram publish error:', err);
    return { success: false, error: err.message };
  }
}

async function createContainer(post, accessToken, igUserId) {
  const contentStr = typeof post.content === 'string' ? post.content.toLowerCase() : '';
  const isVideo = post.platform === 'youtube' || post.content?.includes('video') || contentStr.includes('"type":"video"') || contentStr.includes('"formato":"video"');
  const endpoint = isVideo ? 'media' : 'media';
  const isSingleImage = !isVideo && !post.content?.includes('carousel') && !post.content?.includes('carrossel');
  const params = {
    access_token: accessToken,
    media_type: isVideo ? 'VIDEO' : (isSingleImage ? 'IMAGE' : 'CAROUSEL'),
    caption: `${post.title}\n\n${post.description || ''}\n\n${(post.hashtags || []).map(h => h.replace('#', '')).join(' ')}`
  };
  if (post.mediaUrl) {
    if (isVideo) {
      params.video_url = post.mediaUrl;
    } else {
      params.image_url = post.mediaUrl;
    }
  }
  try {
    const resp = await axios.post(`${GRAPH_API}/${igUserId}/${endpoint}`, null, { params });
    return resp.data;
  } catch (err) {
    if (err.response?.data?.error?.code === 220) {
      return { id: err.response.data.error.error_user_msg };
    }
    throw err;
  }
}

async function publishContainer(containerId, accessToken, igUserId) {
  const resp = await axios.post(`${GRAPH_API}/${igUserId}/media_publish`, null, {
    params: { access_token: accessToken, creation_id: containerId }
  });
  return resp.data;
}

async function getMetrics(post, account) {
  try {
    if (!account?.access_token || !post.published_date) {
      return null;
    }
    const since = Math.floor(new Date(post.published_date).getTime() / 1000);
    const resp = await axios.get(`${GRAPH_API}/${post.platform_id || account.account_id}/insights`, {
      params: {
        access_token: account.access_token,
        metric: 'likes,comments,shares,reach,saved',
        period: 'lifetime',
        since
      }
    });
    const data = resp.data.data || [];
    const metrics = {};
    data.forEach(item => {
      metrics[item.name] = item.values?.[0]?.value || 0;
    });
    return {
      likes: metrics.likes || 0,
      comments: metrics.comments || 0,
      shares: metrics.shares || 0,
      reach: metrics.reach || 0,
      saves: metrics.saved || 0
    };
  } catch (err) {
    console.error('Instagram metrics error:', err);
    return null;
  }
}

module.exports = { publishPost, getMetrics };
