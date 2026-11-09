const { chromium } = require('playwright');
const selectorsMap = require('./routerSelectors');
const configStore = require('./configStore');

class RouterAdapter {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.sessionState = 'DISCONNECTED'; // CONNECTED | RECONNECTING | AUTH_ERROR | DISCONNECTED
    this.lastSyncAt = null;
    this.lastError = null;
    this.keepAliveTimer = null;
  }

  getActiveSelectors(profile) {
    return selectorsMap[profile] || selectorsMap.ZTE_H188A;
  }

  getGatewayUrl(account) {
    return `${account.protocol || 'http'}://${account.routerIp}`;
  }

  async disconnect() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.context = null;
      this.page = null;
    }
    this.sessionState = 'DISCONNECTED';
  }

  async connectWithAccount(account) {
    if (!account || !account.routerIp || !account.username || !account.password) {
      this.sessionState = 'AUTH_ERROR';
      this.lastError = 'Missing router IP, username, or password.';
      throw new Error(this.lastError);
    }

    this.sessionState = 'RECONNECTING';
    this.lastError = null;

    try {
      if (this.browser) {
        await this.browser.close().catch(() => {});
      }

      this.browser = await chromium.launch({
        headless: account.headless !== false,
        args: ['--ignore-certificate-errors', '--no-sandbox', '--disable-setuid-sandbox']
      });

      this.context = await this.browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 1280, height: 800 }
      });

      this.page = await this.context.newPage();
      await this.login(account);
      this.startKeepAlive(account);
      return { ok: true, state: this.sessionState, accountId: account.id };
    } catch (err) {
      this.sessionState = 'AUTH_ERROR';
      this.lastError = `Failed to authenticate with ${account.routerIp}: ${err.message}`;
      throw new Error(this.lastError);
    }
  }

  async login(account) {
    const sel = this.getActiveSelectors(account.profile);
    const baseUrl = this.getGatewayUrl(account);

    await this.page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

    const alreadyLogged = await this.page.$(sel.login.loggedInCheck);
    if (alreadyLogged) {
      this.sessionState = 'CONNECTED';
      this.lastSyncAt = new Date().toISOString();
      return true;
    }

    await this.page.waitForSelector(sel.login.usernameInput, { timeout: 7000 });
    await this.page.fill(sel.login.usernameInput, account.username);
    await this.page.fill(sel.login.passwordInput, account.password);
    await this.page.click(sel.login.submitButton);

    await this.page.waitForTimeout(1800);

    const authErr = await this.page.$(sel.login.errorIndicator);
    if (authErr && (await authErr.isVisible())) {
      this.sessionState = 'AUTH_ERROR';
      this.lastError = 'Invalid router username or password rejected by gateway.';
      throw new Error(this.lastError);
    }

    this.sessionState = 'CONNECTED';
    this.lastSyncAt = new Date().toISOString();
    return true;
  }

  startKeepAlive(account) {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    const interval = Number(process.env.SESSION_KEEPALIVE_MS) || 60000;
    this.keepAliveTimer = setInterval(async () => {
      try {
        if (!this.page || this.page.isClosed()) {
          await this.connectWithAccount(account);
          return;
        }
        const sel = this.getActiveSelectors(account.profile);
        const stillIn = await this.page.$(sel.login.loggedInCheck);
        if (!stillIn) {
          this.sessionState = 'RECONNECTING';
          await this.login(account);
        }
      } catch (err) {
        this.sessionState = 'AUTH_ERROR';
        this.lastError = err.message;
      }
    }, interval);
  }

  async ensureAuthenticated() {
    const account = configStore.getActiveAccount();
    if (!account) {
      this.sessionState = 'DISCONNECTED';
      throw new Error('No router account configured. Please sign in first.');
    }
    if (this.sessionState !== 'CONNECTED' || !this.page || this.page.isClosed()) {
      await this.connectWithAccount(account);
    }
    return account;
  }

  async readText(selector) {
    if (!this.page || this.page.isClosed()) return null;
    try {
      const el = await this.page.$(selector);
      if (!el) return null;
      const txt = (await el.textContent()) || (await el.inputValue());
      return txt ? txt.trim() : null;
    } catch {
      return null;
    }
  }

  async isSessionTimedOut(sel) {
    if (!this.page || this.page.isClosed()) return true;
    try {
      const url = this.page.url() || '';
      if (/sessiontimeout|login/i.test(url)) return true;
      const loginInput = await this.page.$(sel.login.usernameInput);
      if (loginInput && (await loginInput.isVisible().catch(() => false))) {
        return true;
      }
      const bodyText = await this.page.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '');
      if (/SessionTimeout/i.test(bodyText)) return true;
      return false;
    } catch {
      return false;
    }
  }

  async getStatus() {
    const account = await this.ensureAuthenticated();
    const sel = this.getActiveSelectors(account.profile);

    for (let attempt = 0; attempt < 2; attempt++) {
      if (await this.isSessionTimedOut(sel)) {
        this.sessionState = 'RECONNECTING';
        await this.login(account);
      }

      const statusTab = await this.page.$(sel.navigation.statusTab);
      if (statusTab) await statusTab.click().catch(() => {});
      await this.page.waitForTimeout(400);

      const model = await this.readText(sel.status.model);
      const firmware = await this.readText(sel.status.firmware);
      const uptime = await this.readText(sel.status.uptime);
      const wanStatus = await this.readText(sel.status.wanStatus);
      const wanIp = await this.readText(sel.status.wanIp);

      const dslSubTab = await this.page.$(sel.navigation.dslSubTab);
      if (dslSubTab) await dslSubTab.click().catch(() => {});
      await this.page.waitForTimeout(400);

      const downSync = await this.readText(sel.status.dslDownSync);
      const upSync = await this.readText(sel.status.dslUpSync);
      const snrDown = await this.readText(sel.status.snrDown);
      const snrUp = await this.readText(sel.status.snrUp);
      const attenDown = await this.readText(sel.status.attenDown);
      const attenUp = await this.readText(sel.status.attenUp);

      const combinedFields = [model, firmware, uptime, wanStatus, wanIp, downSync, upSync].filter(Boolean).join(' ');
      if (/SessionTimeout/i.test(combinedFields) && attempt === 0) {
        this.sessionState = 'RECONNECTING';
        await this.login(account);
        continue;
      }

      this.lastSyncAt = new Date().toISOString();

      return {
        connectionState: this.sessionState,
        sessionTimeoutDetected: false,
        account: {
          id: account.id,
          label: account.label,
          routerIp: account.routerIp,
          username: account.username,
          profile: account.profile
        },
        lastSyncAt: this.lastSyncAt,
        system: {
          model: model || null,
          firmware: firmware || null,
          uptime: uptime || null,
          wanStatus: wanStatus || null,
          wanIp: wanIp || null,
          dsl: {
            downloadSync: downSync || null,
            uploadSync: upSync || null,
            snrDown: snrDown || null,
            snrUp: snrUp || null,
            attenuationDown: attenDown || null,
            attenuationUp: attenUp || null
          }
        }
      };
    }
  }

  async getDevices() {
    const account = await this.ensureAuthenticated();
    const sel = this.getActiveSelectors(account.profile);
    const nicknames = configStore.getNicknames();

    if (await this.isSessionTimedOut(sel)) {
      this.sessionState = 'RECONNECTING';
      await this.login(account);
    }

    const lanTab = await this.page.$(sel.navigation.lanSubTab);
    if (lanTab) await lanTab.click().catch(() => {});
    await this.page.waitForTimeout(500);

    const rows = await this.page.$$(sel.devices.rowSelector);
    const scraped = [];
    for (const row of rows) {
      const hostname = await row.$eval(sel.devices.hostnameCell, el => el.textContent.trim()).catch(() => '');
      const ip = await row.$eval(sel.devices.ipCell, el => el.textContent.trim()).catch(() => '');
      const mac = await row.$eval(sel.devices.macCell, el => el.textContent.trim().toUpperCase()).catch(() => '');
      const iface = await row.$eval(sel.devices.interfaceCell, el => el.textContent.trim()).catch(() => '');
      if (mac && mac.includes(':')) {
        scraped.push({
          hostname: hostname || 'Unknown Host',
          nickname: nicknames[mac] || '',
          ip: ip || '—',
          mac,
          connectionType: iface.includes('5')
            ? '5GHz'
            : iface.toLowerCase().includes('eth') || iface.toLowerCase().includes('lan')
            ? 'Ethernet'
            : '2.4GHz',
          blocked: false
        });
      }
    }

    return scraped;
  }

  async toggleBlockDevice(mac, block) {
    const account = await this.ensureAuthenticated();
    const normalizedMac = String(mac).toUpperCase().trim();
    const sel = this.getActiveSelectors(account.profile);

    const wlanTab = await this.page.$(sel.navigation.wlanTab);
    if (wlanTab) await wlanTab.click().catch(() => {});
    const macTab = await this.page.$(sel.navigation.macFilterSubTab);
    if (macTab) await macTab.click().catch(() => {});
    await this.page.waitForTimeout(400);

    if (block) {
      const addBtn = await this.page.$(sel.macFilter.addButton);
      if (addBtn) await addBtn.click();
      await this.page.fill(sel.macFilter.macInput, normalizedMac);
      await this.page.click(sel.macFilter.applyButton);
    }

    this.lastSyncAt = new Date().toISOString();
    return {
      ok: true,
      mac: normalizedMac,
      blocked: Boolean(block),
      updatedAt: this.lastSyncAt
    };
  }

  async getWifiSettings() {
    const account = await this.ensureAuthenticated();
    const sel = this.getActiveSelectors(account.profile);

    const wlanTab = await this.page.$(sel.navigation.wlanTab);
    if (wlanTab) await wlanTab.click().catch(() => {});
    await this.page.waitForTimeout(500);

    const ssid24 = await this.readText(sel.wifi.band24.ssidInput);
    const pass24 = await this.readText(sel.wifi.band24.passwordInput);
    const tx24 = await this.readText(sel.wifi.band24.txPowerSelect);
    const width24 = await this.readText(sel.wifi.band24.channelWidthSelect);

    const ssid5 = await this.readText(sel.wifi.band5.ssidInput);
    const pass5 = await this.readText(sel.wifi.band5.passwordInput);
    const tx5 = await this.readText(sel.wifi.band5.txPowerSelect);
    const width5 = await this.readText(sel.wifi.band5.channelWidthSelect);

    return {
      band24: {
        ssid: ssid24 || '',
        password: pass24 || '',
        txPower: tx24 || '100%',
        channelWidth: width24 || '20/40MHz',
        hideSsid: false
      },
      band5: {
        ssid: ssid5 || '',
        password: pass5 || '',
        txPower: tx5 || '100%',
        channelWidth: width5 || '80MHz',
        hideSsid: false
      }
    };
  }

  async updateWifiSettings(payload) {
    const account = await this.ensureAuthenticated();
    const sel = this.getActiveSelectors(account.profile);

    const wlanTab = await this.page.$(sel.navigation.wlanTab);
    if (wlanTab) await wlanTab.click().catch(() => {});
    await this.page.waitForTimeout(400);

    if (payload.band24 && payload.band24.ssid) {
      await this.page.fill(sel.wifi.band24.ssidInput, payload.band24.ssid);
      if (payload.band24.password) {
        await this.page.fill(sel.wifi.band24.passwordInput, payload.band24.password);
      }
      await this.page.click(sel.wifi.band24.saveButton);
    }

    if (payload.band5 && payload.band5.ssid) {
      await this.page.fill(sel.wifi.band5.ssidInput, payload.band5.ssid);
      if (payload.band5.password) {
        await this.page.fill(sel.wifi.band5.passwordInput, payload.band5.password);
      }
      await this.page.click(sel.wifi.band5.saveButton);
    }

    this.lastSyncAt = new Date().toISOString();
    return { ok: true, updatedAt: this.lastSyncAt };
  }

  async rebootRouter() {
    const account = await this.ensureAuthenticated();
    const sel = this.getActiveSelectors(account.profile);

    const mgrTab = await this.page.$(sel.navigation.managementTab);
    if (mgrTab) await mgrTab.click().catch(() => {});
    const rebTab = await this.page.$(sel.navigation.rebootSubTab);
    if (rebTab) await rebTab.click().catch(() => {});
    await this.page.click(sel.reboot.triggerButton);
    await this.page.waitForTimeout(300);
    await this.page.click(sel.reboot.confirmButton);

    this.sessionState = 'RECONNECTING';
    return {
      ok: true,
      message: 'Router reboot command sent to gateway.',
      estimatedDowntimeSeconds: 65
    };
  }
}

module.exports = new RouterAdapter();
