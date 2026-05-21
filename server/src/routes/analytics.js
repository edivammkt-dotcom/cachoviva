const express = require('express');
const router = express.Router();
const config = require('../config');
const ga4 = require('../services/googleAnalytics');

router.get('/ga4', async (req, res) => {
  try {
    const propertyId = config.ga4?.propertyId;
    if (!propertyId) {
      return res.json({
        configured: false,
        message: 'GA4 não configurado. Adicione GA4_PROPERTY_ID, GA4_CLIENT_EMAIL e GA4_PRIVATE_KEY no .env',
        overview: null, trafficSources: [], devices: [], pages: [],
      });
    }

    const [overview, trafficSources, devices, pages] = await Promise.all([
      ga4.getOverview(propertyId),
      ga4.getTrafficSources(propertyId),
      ga4.getDeviceCategories(propertyId),
      ga4.getPages(propertyId),
    ]);

    res.json({
      configured: true,
      propertyId: propertyId,
      overview: overview?.overview || null,
      daily: overview?.daily || [],
      trafficSources: trafficSources || [],
      devices: devices || [],
      pages: pages || [],
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Analytics] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/ga4/status', (req, res) => {
  res.json({
    configured: !!(config.ga4?.propertyId && config.ga4?.clientEmail && config.ga4?.privateKey),
    propertyId: config.ga4?.propertyId || null,
    message: config.ga4?.propertyId ? 'GA4 configurado' : 'GA4 não configurado',
  });
});

module.exports = router;
