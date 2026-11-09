const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.enc.json');
const NICKNAMES_FILE = path.join(DATA_DIR, 'nicknames.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SECRET = crypto
  .createHash('sha256')
  .update(process.env.LOCAL_CONFIG_SECRET || 'smart-router-default-local-secret-key')
  .digest();

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', SECRET, iv);
  let encrypted = cipher.update(String(text || ''), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(payload) {
  if (!payload || !payload.includes(':')) return '';
  try {
    const [ivHex, encryptedHex] = payload.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

function loadAccountsState() {
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    const initial = { activeAccountId: null, accounts: [] };
    if (process.env.ROUTER_USER && process.env.ROUTER_PASS) {
      const envId = 'acc_env_default';
      initial.accounts.push({
        id: envId,
        label: `Default Router (${process.env.ROUTER_IP || '192.168.1.1'})`,
        routerIp: process.env.ROUTER_IP || '192.168.1.1',
        protocol: process.env.ROUTER_PROTOCOL || 'http',
        username: process.env.ROUTER_USER,
        passwordEnc: encrypt(process.env.ROUTER_PASS),
        profile: process.env.ROUTER_PROFILE || 'ZTE_H188A',
        headless: process.env.HEADLESS !== 'false',
        updatedAt: new Date().toISOString()
      });
      initial.activeAccountId = envId;
    }
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
  } catch {
    return { activeAccountId: null, accounts: [] };
  }
}

function saveAccountsState(state) {
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function listAccounts() {
  const state = loadAccountsState();
  return {
    activeAccountId: state.activeAccountId,
    accounts: state.accounts.map(a => ({
      id: a.id,
      isp: a.isp || 'WE',
      label: a.label,
      routerIp: a.routerIp,
      protocol: a.protocol || 'http',
      username: a.username,
      profile: a.profile || 'ZTE_H188A',
      headless: typeof a.headless === 'boolean' ? a.headless : true,
      updatedAt: a.updatedAt
    }))
  };
}

function getActiveAccount() {
  const state = loadAccountsState();
  const found = state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0] || null;
  if (!found) return null;
  return {
    id: found.id,
    isp: found.isp || 'WE',
    label: found.label,
    routerIp: found.routerIp,
    protocol: found.protocol || 'http',
    username: found.username,
    password: decrypt(found.passwordEnc),
    profile: found.profile || 'ZTE_H188A',
    headless: typeof found.headless === 'boolean' ? found.headless : true
  };
}

function saveAccount({ id, isp, label, routerIp, protocol, username, password, profile, headless }) {
  const state = loadAccountsState();
  const cleanIp = String(routerIp || '192.168.1.1').trim();
  const cleanUser = String(username || 'admin').trim();
  const cleanLabel = String(label || `Router (${cleanIp})`).trim();
  const accountId = id || `acc_${Date.now()}`;

  const existingIndex = state.accounts.findIndex(a => a.id === accountId);
  const existing = existingIndex >= 0 ? state.accounts[existingIndex] : null;

  const record = {
    id: accountId,
    isp: isp || (existing && existing.isp) || 'WE',
    label: cleanLabel,
    routerIp: cleanIp,
    protocol: protocol || (existing && existing.protocol) || 'http',
    username: cleanUser,
    passwordEnc: password ? encrypt(password) : (existing ? existing.passwordEnc : ''),
    profile: profile || (existing && existing.profile) || 'ZTE_H188A',
    headless: typeof headless === 'boolean' ? headless : (existing ? existing.headless : true),
    updatedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    state.accounts[existingIndex] = record;
  } else {
    state.accounts.push(record);
  }
  state.activeAccountId = accountId;
  saveAccountsState(state);
  return getActiveAccount();
}

function setActiveAccount(accountId) {
  const state = loadAccountsState();
  const target = state.accounts.find(a => a.id === accountId);
  if (!target) throw new Error('Account not found');
  state.activeAccountId = accountId;
  saveAccountsState(state);
  return getActiveAccount();
}

function deleteAccount(accountId) {
  const state = loadAccountsState();
  state.accounts = state.accounts.filter(a => a.id !== accountId);
  if (state.activeAccountId === accountId) {
    state.activeAccountId = state.accounts[0] ? state.accounts[0].id : null;
  }
  saveAccountsState(state);
  return listAccounts();
}

function getNicknames() {
  if (!fs.existsSync(NICKNAMES_FILE)) {
    fs.writeFileSync(NICKNAMES_FILE, JSON.stringify({}, null, 2), 'utf8');
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(NICKNAMES_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveNickname(mac, nickname) {
  const map = getNicknames();
  const normalizedMac = String(mac).toUpperCase().trim();
  if (!nickname || !nickname.trim()) {
    delete map[normalizedMac];
  } else {
    map[normalizedMac] = nickname.trim();
  }
  fs.writeFileSync(NICKNAMES_FILE, JSON.stringify(map, null, 2), 'utf8');
  return map;
}

module.exports = {
  listAccounts,
  getActiveAccount,
  saveAccount,
  setActiveAccount,
  deleteAccount,
  getNicknames,
  saveNickname
};
