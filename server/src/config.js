require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3001'),
  env: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'cachoviva-dev-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  db: {
    path: process.env.DB_PATH || './data/database.sqlite'
  },
  social: {
    instagram: {
      appId: process.env.INSTAGRAM_APP_ID || '',
      appSecret: process.env.INSTAGRAM_APP_SECRET || '',
      redirectUri: process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:3001/api/social/instagram/callback'
    },
    tiktok: {
      clientKey: process.env.TIKTOK_CLIENT_KEY || '',
      clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
      redirectUri: process.env.TIKTOK_REDIRECT_URI || 'http://localhost:3001/api/social/tiktok/callback'
    },
    youtube: {
      apiKey: process.env.YOUTUBE_API_KEY || '',
      clientId: process.env.YOUTUBE_CLIENT_ID || '',
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
      redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3001/api/social/youtube/callback'
    }
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    textModel: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash-lite',
    imageModel: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-exp-image-generation'
  },
  intervals: {
    publishCheck: process.env.PUBLISH_CHECK_INTERVAL || '*/15 * * * *',
    metricsCollect: process.env.METRICS_COLLECT_INTERVAL || '0 */6 * * *'
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    pollInterval: parseInt(process.env.TELEGRAM_POLL_INTERVAL || '5000')
  },
  research: {
    schedule: process.env.RESEARCH_SCHEDULE || '0 8,14 * * 1-5',
    autoApprove: process.env.RESEARCH_AUTO_APPROVE === 'true'
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || '',
  },
  ga4: {
    propertyId: process.env.GA4_PROPERTY_ID || '',
    clientEmail: process.env.GA4_CLIENT_EMAIL || '',
    privateKey: process.env.GA4_PRIVATE_KEY || '',
  }
};
