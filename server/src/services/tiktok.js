const axios = require('axios');
const { getDb } = require('../database');

const TIKTOK_API = 'https://open.tiktokapis.com/v2';

async function publishPost(post, account) {
  try {
    if (!account?.access_token) {
      return { success: false, error: 'Conta do TikTok não conectada' };
    }
    const videoId = await uploadVideo(post, account.access_token);
    if (!videoId) {
      return { success: false, error: 'Falha ao upload de vídeo' };
    }
    const result = await createPost(videoId, post, account.access_token);
    return { success: true, data: result };
  } catch (err) {
    console.error('TikTok publish error:', err);
    return { success: false, error: err.message };
  }
}

async function uploadVideo(post, accessToken) {
  try {
    const initResp = await axios.post(`${TIKTOK_API}/video/init/`, {
      source_info: { source: 'FILE_UPLOAD' },
      post_info: {
        title: post.title,
        privacy_level: 'PUBLIC',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false
      }
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    const publishId = initResp.data.data?.publish_id;
    if (!publishId) {
      throw new Error('Falha ao iniciar upload');
    }
    return publishId;
  } catch (err) {
    console.error('TikTok upload error:', err);
    throw err;
  }
}

async function createPost(videoId, post, accessToken) {
  const resp = await axios.post(`${TIKTOK_API}/video/publish/`, {
    video_id: videoId,
    post_info: {
      title: `${post.title}\n\n${post.description || ''}\n\n${(post.hashtags || []).map(h => h.replace('#', '')).join(' ')}`,
      privacy_level: 'PUBLIC',
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false
    }
  }, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  return resp.data;
}

async function getMetrics(post, account) {
  try {
    if (!account?.access_token) {
      return null;
    }
    const resp = await axios.post(`${TIKTOK_API}/video/query/`, {
      filters: { video_ids: [post.platform_id] }
    }, {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    const video = resp.data.data?.videos?.[0];
    if (!video) return null;
    return {
      likes: video.like_count || 0,
      comments: video.comment_count || 0,
      shares: video.share_count || 0,
      reach: video.view_count || 0,
      saves: video.favorite_count || 0
    };
  } catch (err) {
    console.error('TikTok metrics error:', err);
    return null;
  }
}

module.exports = { publishPost, getMetrics };
