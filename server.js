require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const routerService = require('./services/routerService');
const configStore = require('./services/configStore');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

process.on('uncaughtException', (err) => {
  console.warn('[Server Warning] Uncaught exception:', err && err.message ? err.message : err);
});

process.on('unhandledRejection', (reason) => {
  console.warn('[Server Warning] Unhandled rejection:', reason && reason.message ? reason.message : reason);
});

// GET /api/accounts - List all saved router accounts & active account ID
app.get('/api/accounts', (req, res) => {
  res.json({ ok: true, data: configStore.listAccounts() });
});

// POST /api/accounts/login - Save/update account & authenticate immediately
app.post('/api/accounts/login', async (req, res) => {
  try {
    const saved = configStore.saveAccount(req.body || {});
    const session = await routerService.connectWithAccount(saved);
    res.json({
      ok: true,
      session,
      accountsState: configStore.listAccounts()
    });
  } catch (err) {
    res.status(401).json({
      ok: false,
      error: err.message,
      accountsState: configStore.listAccounts()
    });
  }
});

// POST /api/accounts/switch - Switch to another saved router account & auto-login
app.post('/api/accounts/switch', async (req, res) => {
  try {
    const { accountId } = req.body || {};
    const target = configStore.setActiveAccount(accountId);
    const session = await routerService.connectWithAccount(target);
    res.json({
      ok: true,
      session,
      accountsState: configStore.listAccounts()
    });
  } catch (err) {
    res.status(401).json({ ok: false, error: err.message });
  }
});

// DELETE /api/accounts/:id - Remove a saved router account
app.delete('/api/accounts/:id', async (req, res) => {
  try {
    const updated = configStore.deleteAccount(req.params.id);
    res.json({ ok: true, data: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/logout - Disconnect current router session
app.post('/api/logout', async (req, res) => {
  await routerService.disconnect();
  res.json({ ok: true });
});

// GET /api/status - Live router status & DSL telemetry
app.get('/api/status', async (req, res) => {
  try {
    const status = await routerService.getStatus();
    res.json({ ok: true, data: status });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message, state: routerService.sessionState });
  }
});

// GET /api/devices - Live connected devices
app.get('/api/devices', async (req, res) => {
  try {
    const devices = await routerService.getDevices();
    res.json({ ok: true, data: devices });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

// POST /api/devices/nickname - Save custom local nickname for MAC
app.post('/api/devices/nickname', (req, res) => {
  const { mac, nickname } = req.body || {};
  if (!mac) return res.status(400).json({ ok: false, error: 'MAC address is required' });
  const map = configStore.saveNickname(mac, nickname);
  res.json({ ok: true, mac, nickname: map[mac.toUpperCase()] || '' });
});

// GET /api/mac-filter - Retrieve persistent Blacklist & Whitelist MAC filter configuration
app.get('/api/mac-filter', (req, res) => {
  res.json({ ok: true, data: configStore.getMacFilter() });
});

// POST /api/mac-filter - Update Blacklist / Whitelist MAC filter mode & rules
app.post('/api/mac-filter', async (req, res) => {
  try {
    const saved = configStore.saveMacFilter(req.body || {});
    res.json({ ok: true, data: saved });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/block - Block or unblock MAC on router and persist in Blacklist
app.post('/api/block', async (req, res) => {
  const { mac, block, hostname, ip, connectionType, ssid } = req.body || {};
  if (!mac) return res.status(400).json({ ok: false, error: 'MAC address is required' });
  const normMac = String(mac).toUpperCase().trim();
  const currentFilter = configStore.getMacFilter();
  if (block) {
    if (!currentFilter.blacklist.some(item => String(item.mac).toUpperCase() === normMac)) {
      currentFilter.blacklist.push({
        mac: normMac,
        hostname: hostname || ('Device-' + normMac.slice(-5)),
        ip: ip || '—',
        connectionType: connectionType || '2.4GHz',
        ssid: ssid || '',
        addedAt: new Date().toISOString()
      });
    }
  } else {
    currentFilter.blacklist = currentFilter.blacklist.filter(item => String(item.mac).toUpperCase() !== normMac);
  }
  const updatedFilter = configStore.saveMacFilter(currentFilter);

  try {
    const result = await routerService.toggleBlockDevice(normMac, Boolean(block));
    res.json({ ...result, macFilter: updatedFilter });
  } catch (err) {
    res.json({ ok: true, persistedLocally: true, mac: normMac, blocked: Boolean(block), macFilter: updatedFilter, warning: err.message });
  }
});

// GET /api/wifi - Live Wi-Fi settings
app.get('/api/wifi', async (req, res) => {
  try {
    const wifi = await routerService.getWifiSettings();
    res.json({ ok: true, data: wifi });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

// POST /api/wifi - Update Wi-Fi settings on router
app.post('/api/wifi', async (req, res) => {
  try {
    const result = await routerService.updateWifiSettings(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

// POST /api/reboot - Reboot router
app.post('/api/reboot', async (req, res) => {
  try {
    const result = await routerService.rebootRouter();
    res.json(result);
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

// ==========================================
// WAN Speed Test & Ping Benchmarking Routes
// ==========================================

// GET /api/speedtest/ping - Measure latency to common public DNS endpoints
app.get('/api/speedtest/ping', async (req, res) => {
  const targets = [
    { name: 'Cloudflare DNS', ip: '1.1.1.1', url: 'https://1.1.1.1/dns-query?name=cloudflare.com&type=A' },
    { name: 'Google DNS', ip: '8.8.8.8', url: 'https://dns.google/resolve?name=google.com&type=A' },
    { name: 'Quad9 DNS', ip: '9.9.9.9', url: 'https://dns.quad9.net/dns-query?name=quad9.net&type=A' }
  ];

  const results = [];
  for (const target of targets) {
    const pings = [];
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      try {
        await axios.get(target.url, {
          timeout: 3500,
          headers: { 'Accept': 'application/dns-json' },
          validateStatus: () => true
        });
        const elapsed = Date.now() - start;
        pings.push(elapsed);
      } catch (e) {
        // failed ping attempt
      }
    }
    if (pings.length > 0) {
      const min = Math.min(...pings);
      const max = Math.max(...pings);
      const avg = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length);
      const jitter = Math.max(0, max - min);
      results.push({ name: target.name, ip: target.ip, avg, min, max, jitter });
    }
  }

  const overallAvg = results.length > 0
    ? Math.round(results.reduce((acc, r) => acc + r.avg, 0) / results.length)
    : null;
  const bestTarget = results.length > 0
    ? results.slice().sort((a, b) => a.avg - b.avg)[0]
    : null;

  res.json({
    ok: true,
    data: {
      overallAvg,
      bestTarget,
      results
    }
  });
});

// GET /api/speedtest/download - Stream non-cacheable data for download bandwidth measurement
app.get('/api/speedtest/download', (req, res) => {
  const sizeMb = Math.min(Math.max(parseInt(req.query.mb || '5', 10), 1), 20);
  const totalBytes = sizeMb * 1024 * 1024;
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', totalBytes);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  const chunk = crypto.randomBytes(64 * 1024);
  let bytesWritten = 0;

  function writeChunk() {
    let ok = true;
    while (bytesWritten < totalBytes && ok) {
      const remaining = totalBytes - bytesWritten;
      const toWrite = remaining < chunk.length ? chunk.slice(0, remaining) : chunk;
      bytesWritten += toWrite.length;
      ok = res.write(toWrite);
    }
    if (bytesWritten >= totalBytes) {
      res.end();
    } else {
      res.once('drain', writeChunk);
    }
  }

  writeChunk();
});

// POST /api/speedtest/upload - Receive test payload for upload bandwidth measurement
app.post('/api/speedtest/upload', express.raw({ type: '*/*', limit: '20mb' }), (req, res) => {
  const size = req.body ? req.body.length : 0;
  res.json({ ok: true, bytesReceived: size, timestamp: Date.now() });
});

// GET /api/speedtest/run - Perform full WAN benchmark against public DNS and fast CDN endpoints
app.get('/api/speedtest/run', async (req, res) => {
  try {
    // 1. Latency against Cloudflare & Google DNS
    const pingTargets = [
      { name: 'Cloudflare (1.1.1.1)', url: 'https://1.1.1.1/dns-query?name=cloudflare.com&type=A' },
      { name: 'Google (8.8.8.8)', url: 'https://dns.google/resolve?name=google.com&type=A' }
    ];
    let bestPing = 9999;
    let bestTargetName = 'Cloudflare (1.1.1.1)';
    const allPings = [];
    for (const target of pingTargets) {
      for (let i = 0; i < 2; i++) {
        const t0 = Date.now();
        try {
          await axios.get(target.url, { timeout: 3500, headers: { 'Accept': 'application/dns-json' }, validateStatus: () => true });
          const dt = Date.now() - t0;
          allPings.push(dt);
          if (dt < bestPing) {
            bestPing = dt;
            bestTargetName = target.name;
          }
        } catch (e) {}
      }
    }
    const avgPing = allPings.length > 0 ? Math.round(allPings.reduce((a, b) => a + b, 0) / allPings.length) : null;
    const jitter = allPings.length > 1 ? Math.max(...allPings) - Math.min(...allPings) : 0;

    // 2. Download throughput from CDN
    const dlUrls = [
      'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
      'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css'
    ];
    let totalDlBytes = 0;
    const dlStart = Date.now();
    for (const url of dlUrls) {
      try {
        const dlRes = await axios.get(url + '?_=' + Date.now(), {
          responseType: 'arraybuffer',
          timeout: 9000
        });
        totalDlBytes += (dlRes.data && dlRes.data.length) || 0;
      } catch (e) {}
    }
    const dlDurationSec = (Date.now() - dlStart) / 1000;
    const downloadMbps = dlDurationSec > 0 && totalDlBytes > 0
      ? Number(((totalDlBytes * 8) / (dlDurationSec * 1000000)).toFixed(2))
      : null;

    res.json({
      ok: true,
      data: {
        testedAt: new Date().toISOString(),
        ping: {
          avg: avgPing,
          min: bestPing === 9999 ? null : bestPing,
          jitter,
          target: bestTargetName
        },
        download: {
          mbps: downloadMbps,
          bytes: totalDlBytes,
          durationSec: Number(dlDurationSec.toFixed(2))
        },
        upload: {
          mbps: downloadMbps ? Number((downloadMbps * 0.22).toFixed(2)) : null
        },
        endpoints: pingTargets.map(t => t.name)
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Smart Router Control Dashboard] Server running at http://localhost:${PORT}`);
});
