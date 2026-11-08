require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const routerService = require('./services/routerService');
const configStore = require('./services/configStore');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Auto-login on startup if a saved account exists
(async () => {
  const active = configStore.getActiveAccount();
  if (active && active.password) {
    try {
      await routerService.connectWithAccount(active);
      console.log(`[Startup] Auto-logged into router ${active.routerIp} (${active.label})`);
    } catch (err) {
      console.warn(`[Startup] Auto-login failed for ${active.routerIp}: ${err.message}`);
    }
  }
})();

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

// POST /api/block - Block or unblock MAC on router
app.post('/api/block', async (req, res) => {
  try {
    const { mac, block } = req.body || {};
    if (!mac) return res.status(400).json({ ok: false, error: 'MAC address is required' });
    const result = await routerService.toggleBlockDevice(mac, Boolean(block));
    res.json(result);
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
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

app.listen(PORT, () => {
  console.log(`[Smart Router Control Dashboard] Server running at http://localhost:${PORT}`);
});
