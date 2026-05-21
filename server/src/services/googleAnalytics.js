const config = require('../config');

let client = null;

function getClient() {
  if (client) return client;
  if (!config.ga4?.clientEmail || !config.ga4?.privateKey) return null;
  try {
    const { BetaAnalyticsDataClient } = require('@google-analytics/data');
    client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: config.ga4.clientEmail,
        private_key: config.ga4.privateKey.replace(/\\n/g, '\n'),
      },
    });
    return client;
  } catch {
    return null;
  }
}

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? m + 'm ' + s + 's' : s + 's';
}

async function fetchReport(propertyId, startDate, endDate, metrics, dimensions) {
  const c = getClient();
  if (!c) return null;
  try {
    const [response] = await c.runReport({
      property: 'properties/' + propertyId,
      dateRanges: [{ startDate: startDate || '7daysAgo', endDate: endDate || 'today' }],
      metrics: metrics.map(function(m) { return { name: m }; }),
      dimensions: dimensions ? dimensions.map(function(d) { return { name: d }; }) : undefined,
    });
    return response;
  } catch {
    return null;
  }
}

async function getOverview(propertyId) {
  var c = getClient();
  if (!c) return null;

  var report = await fetchReport(propertyId, '30daysAgo', 'today', [
    'screenPageViews', 'totalUsers', 'newUsers', 'sessions',
    'averageSessionDuration', 'bounceRate'
  ], ['date']);

  if (!report || !report.rows) return null;

  var totals = { pageViews: 0, users: 0, newUsers: 0, sessions: 0, sessionDuration: 0, bounceRateSum: 0, days: 0 };
  var daily = [];

  report.rows.forEach(function(row) {
    var date = row.dimensionValues[0].value;
    var vals = row.metricValues;
    totals.pageViews += parseInt(vals[0].value || 0);
    totals.users += parseInt(vals[1].value || 0);
    totals.newUsers += parseInt(vals[2].value || 0);
    totals.sessions += parseInt(vals[3].value || 0);
    totals.sessionDuration += parseFloat(vals[4].value || 0);
    totals.bounceRateSum += parseFloat(vals[5].value || 0);
    totals.days++;
    daily.push({
      date: date.slice(0, 4) + '-' + date.slice(4, 6) + '-' + date.slice(6, 8),
      pageViews: parseInt(vals[0].value || 0),
      users: parseInt(vals[1].value || 0),
      sessions: parseInt(vals[3].value || 0),
    });
  });

  return {
    overview: {
      pageViews: totals.pageViews,
      totalUsers: totals.users,
      newUsers: totals.newUsers,
      sessions: totals.sessions,
      avgSessionDuration: formatDuration(totals.sessionDuration / Math.max(totals.days, 1)),
      bounceRate: totals.days > 0 ? (totals.bounceRateSum / totals.days).toFixed(1) + '%' : '0%',
    },
    daily: daily,
  };
}

async function getTrafficSources(propertyId) {
  var report = await fetchReport(propertyId, '30daysAgo', 'today', ['sessions'], ['sessionSource']);

  if (!report || !report.rows) return [];

  var sources = report.rows.map(function(row) {
    return {
      source: row.dimensionValues[0].value || '(direct)',
      sessions: parseInt(row.metricValues[0].value || 0),
    };
  });

  sources.sort(function(a, b) { return b.sessions - a.sessions; });
  return sources.slice(0, 10);
}

async function getDeviceCategories(propertyId) {
  var report = await fetchReport(propertyId, '30daysAgo', 'today', ['sessions'], ['deviceCategory']);

  if (!report || !report.rows) return [];

  return report.rows.map(function(row) {
    return {
      device: row.dimensionValues[0].value,
      sessions: parseInt(row.metricValues[0].value || 0),
    };
  });
}

async function getPages(propertyId) {
  var report = await fetchReport(propertyId, '30daysAgo', 'today', ['screenPageViews'], ['pagePathPlusQueryString']);

  if (!report || !report.rows) return [];

  var pages = report.rows.map(function(row) {
    return {
      path: row.dimensionValues[0].value,
      views: parseInt(row.metricValues[0].value || 0),
    };
  });

  pages.sort(function(a, b) { return b.views - a.views; });
  return pages.slice(0, 10);
}

module.exports = {
  getOverview,
  getTrafficSources,
  getDeviceCategories,
  getPages,
};
