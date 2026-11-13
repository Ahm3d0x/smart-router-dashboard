const test = require('node:test');
const assert = require('node:assert/strict');

function isSessionTimeoutText(str) {
  if (!str) return false;
  return /session\s*timeout|session_timeout|session\s*expired/i.test(String(str));
}

function isZteEncryptedOrMaskedPass(val) {
  const s = String(val || '').trim();
  if (!s) return true;
  if (/^\*+$/.test(s)) return true;
  if (/^•+$/.test(s)) return true;
  if (/^[A-Za-z0-9+/]{22}==$/.test(s)) return true;
  if (/^[A-Za-z0-9+/]{16,}={1,2}$/.test(s) && /[+/]/.test(s)) return true;
  if (/^[0-9a-fA-F]{32,64}$/.test(s)) return true;
  return false;
}

function sanitizeWifiPasswordVault(vault, routerLoginPass) {
  const cleaned = { ...(vault || {}) };
  if (!routerLoginPass) return cleaned;
  for (const k of Object.keys(cleaned)) {
    if (cleaned[k] === routerLoginPass) {
      delete cleaned[k];
    }
  }
  return cleaned;
}

function resolvePlaintextWifiPassword(instId, ssid, candidatePass, vault, routerLoginPass) {
  const cleanCand = (!isZteEncryptedOrMaskedPass(candidatePass)) ? String(candidatePass || '').trim() : '';
  if (cleanCand && cleanCand !== routerLoginPass) return cleanCand;
  if (instId && vault[instId] && !isZteEncryptedOrMaskedPass(vault[instId]) && vault[instId] !== routerLoginPass) {
    return vault[instId];
  }
  if (ssid && vault['SSID:' + ssid] && !isZteEncryptedOrMaskedPass(vault['SSID:' + ssid]) && vault['SSID:' + ssid] !== routerLoginPass) {
    return vault['SSID:' + ssid];
  }
  return '';
}

function extractZteObjects(xml, objName) {
  const objects = [];
  const objRegex = new RegExp(`<OBJ_${objName}_ID>([\\s\\S]*?)<\\/OBJ_${objName}_ID>`, 'gi');
  let objMatch;
  while ((objMatch = objRegex.exec(xml)) !== null) {
    const block = objMatch[1];
    const instances = [];
    const instRegex = /<Instance>([\s\S]*?)<\/Instance>/gi;
    let instMatch;
    while ((instMatch = instRegex.exec(block)) !== null) {
      const instXml = instMatch[1];
      const map = {};
      const pairRegex = /<ParaName>([^<]+)<\/ParaName>\s*<ParaValue>([^<]*)<\/ParaValue>/gi;
      let pairMatch;
      while ((pairMatch = pairRegex.exec(instXml)) !== null) {
        map[pairMatch[1].trim()] = pairMatch[2].trim();
      }
      if (Object.keys(map).length > 0) instances.push(map);
    }
    objects.push(...instances);
  }
  return objects;
}

function parseZteWlanConfigFromXml(combinedWlanXml, vault = {}, routerLoginPass = '') {
  const apInstances = [
    ...extractZteObjects(combinedWlanXml, 'WLANAP'),
    ...extractZteObjects(combinedWlanXml, 'WLANSSID'),
    ...extractZteObjects(combinedWlanXml, 'SSID'),
  ];
  const drvInstances = extractZteObjects(combinedWlanXml, 'WLANCONFIGDRV');
  const settingInstances = [
    ...extractZteObjects(combinedWlanXml, 'WLANSETTING'),
    ...extractZteObjects(combinedWlanXml, 'WLANRADIO'),
    ...extractZteObjects(combinedWlanXml, 'CHANNEL'),
  ];
  const pskInstances = [
    ...extractZteObjects(combinedWlanXml, 'WLANPSK'),
    ...extractZteObjects(combinedWlanXml, 'PSK'),
    ...extractZteObjects(combinedWlanXml, 'WLANSEC'),
    ...extractZteObjects(combinedWlanXml, 'WEP'),
  ];

  const apByInstId = new Map();
  for (const ap of apInstances) {
    const id = ap._InstID || ap.ViewName || ap.SSIDIndex || '';
    if (!id) continue;
    apByInstId.set(id, { ...(apByInstId.get(id) || {}), ...ap });
  }
  for (const drv of drvInstances) {
    const id = drv._InstID || drv.ViewName || '';
    if (!id || !/AP\d+/i.test(id)) continue;
    const existing = apByInstId.get(id) || { _InstID: id };
    if (drv.BSSID) existing.BSSID = drv.BSSID;
    if (drv.RealChannel && !existing.Channel) existing.Channel = drv.RealChannel;
    if (drv.UpTime) existing.UpTime = drv.UpTime;
    apByInstId.set(id, existing);
  }

  const dedupedAps = Array.from(apByInstId.values()).filter(ap => ap.ESSID || ap.SSID);

  const radioByBand = { '2.4GHz': {}, '5GHz': {} };
  settingInstances.forEach((r, idx) => {
    const id = String(r._InstID || r.ViewName || '');
    const bandStr = String(r.Band || r.OperatingFrequencyBand || r.FreqBand || '');
    const is5 = /5G/i.test(bandStr) || /RD2|RADIO2|_2$/i.test(id) || (!id && idx === 1);
    const key = is5 ? '5GHz' : '2.4GHz';
    radioByBand[key] = { ...radioByBand[key], ...r };
  });

  const pskByInstId = new Map();
  pskInstances.forEach((p, idx) => {
    const id = p._InstID || p.ViewName || `AP${idx + 1}`;
    pskByInstId.set(id, { ...(pskByInstId.get(id) || {}), ...p });
  });

  const ssids = [];
  dedupedAps.forEach((ap, i) => {
    const instId = ap._InstID || ap.ViewName || `DEV.WIFI.AP${i + 1}`;
    const apNumMatch = String(instId).match(/(\d+)$/);
    const slotNum = apNumMatch ? Number(apNumMatch[1]) : (i + 1);
    const is5GHz = /5G/i.test(ap.Band || ap.OperatingFrequencyBand || ap.WlBand || '') || slotNum >= 5;
    const band = is5GHz ? '5GHz' : '2.4GHz';
    const radio = radioByBand[band] || {};
    const pskObj = pskByInstId.get(instId) || pskInstances[slotNum - 1] || pskInstances[i] || {};

    const rawPass = pskObj.KeyPassphrase || pskObj.PreSharedKey || pskObj.Password || pskObj.WPAPassphrase || ap.KeyPassphrase || ap.PreSharedKey || ap.Password || '';
    const ssidName = ap.ESSID || ap.SSID || `SSID${slotNum}`;
    const resolvedPass = resolvePlaintextWifiPassword(instId, ssidName, rawPass, vault, routerLoginPass);

    const bwRaw = String(radio.BandWidth || ap.BandWidth || (is5GHz ? '80MHz' : '20/40MHz')).trim();
    const normBw = /80/.test(bwRaw) ? '80MHz' : (/20\s*\/\s*40|auto/i.test(bwRaw) ? '20/40MHz' : (/40/.test(bwRaw) ? '40MHz' : '20MHz'));
    const txRaw = String(radio.TxPower || ap.TxPower || '100%').replace('%', '').trim();
    const normTx = ['100', '80', '60', '40', '20'].includes(txRaw) ? `${txRaw}%` : '100%';

    let hidden = false;
    if (ap.Hidden !== undefined) {
      hidden = ap.Hidden === '1' || String(ap.Hidden).toLowerCase() === 'true';
    } else if (ap.HideSSID !== undefined) {
      hidden = ap.HideSSID === '1' || String(ap.HideSSID).toLowerCase() === 'true';
    } else if (ap.SSIDAdvertisementEnabled !== undefined) {
      hidden = ap.SSIDAdvertisementEnabled === '0' || String(ap.SSIDAdvertisementEnabled).toLowerCase() === 'false';
    }

    const enabled = ap.Enable !== undefined ? (ap.Enable === '1' || String(ap.Enable).toLowerCase() === 'true') : true;

    ssids.push({
      slot: slotNum,
      instId,
      pskInstId: pskObj._InstID || instId,
      radioInstId: radio._InstID || (is5GHz ? 'DEV.WIFI.RD2' : 'DEV.WIFI.RD1'),
      band,
      ssid: ssidName,
      enabled,
      hidden,
      password: resolvedPass,
      hasRouterEncryptedPass: isZteEncryptedOrMaskedPass(rawPass) && Boolean(rawPass),
      security: ap.BeaconType || pskObj.BeaconType || '11i',
      wpaAuthMode: ap.WPAAuthMode || 'PSKAuthentication',
      wpaEncryptType: ap.WPAEncryptType || 'AESEncryption',
      '11iAuthMode': ap['11iAuthMode'] || 'PSKAuthentication',
      '11iEncryptType': ap['11iEncryptType'] || 'AESEncryption',
      channel: String(radio.Channel || ap.Channel || (is5GHz ? '36' : 'Auto')),
      autoChannel: radio.AutoChannelEnabled !== undefined ? radio.AutoChannelEnabled : (String(radio.Channel || '0') === '0' ? '1' : '0'),
      channelWidth: normBw,
      txPower: normTx,
      bssid: ap.BSSID || '',
      maxClients: Number(ap.MaxStaNum || ap.MaxAssocNum || 32),
      rawAp: ap
    });
  });

  ssids.sort((a, b) => a.slot - b.slot);
  return ssids;
}

function buildZteSsidPostPayload(instId, pskInstId, cfg, sessionToken) {
  const existingAp = (cfg && cfg.rawAp) ? cfg.rawAp : {};
  const secType = cfg.security || existingAp.BeaconType || '11i';
  const isOpen = secType === 'None' || secType === 'Basic';
  const hideVal = cfg.hidden ? '1' : '0';
  const advVal = cfg.hidden ? '0' : '1';
  const enableVal = cfg.enabled !== false ? '1' : '0';
  const maxSta = String(cfg.maxClients || existingAp.MaxStaNum || '32');

  const params = {
    IF_ACTION: 'Apply',
    _InstID: instId,
    Enable: enableVal,
    ESSID: cfg.ssid,
    SSID: cfg.ssid,
    Hidden: hideVal,
    HideSSID: hideVal,
    SSIDAdvertisementEnabled: advVal,
    WlanHide: hideVal,
    VapIsolationEnable: existingAp.VapIsolationEnable || '0',
     IsolationEnable: existingAp.IsolationEnable || '0',
    MaxStaNum: maxSta,
    BeaconType: secType,
    WEPAuthMode: existingAp.WEPAuthMode || 'None',
    WPAAuthMode: existingAp.WPAAuthMode || 'PSKAuthentication',
    WPAEncryptType: secType === 'WPAand11i' ? 'TKIPandAESEncryption' : (existingAp.WPAEncryptType || 'AESEncryption'),
    '11iAuthMode': existingAp['11iAuthMode'] || 'PSKAuthentication',
    '11iEncryptType': secType === 'WPAand11i' ? 'TKIPandAESEncryption' : (existingAp['11iEncryptType'] || 'AESEncryption'),
    WdsMode: existingAp.WdsMode || 'WDS_Disable',
    _sessionTOKEN: sessionToken
  };

  const trimmedPass = (cfg.password !== undefined && cfg.password !== null) ? String(cfg.password).trim() : '';
  if (!isOpen && trimmedPass.length >= 8 && !isZteEncryptedOrMaskedPass(trimmedPass)) {
    params.KeyPassphrase = trimmedPass;
    params.PreSharedKey = trimmedPass;
    params.Passphrase = trimmedPass;
  }
  return params;
}

function normalizeMacAddress(mac) {
  const clean = String(mac || '').trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  if (clean.length === 12) {
    return clean.match(/.{2}/g).join(':');
  }
  return String(mac || '').trim().toUpperCase();
}

function mergeDevicesWithMacFilter(rawDevices, macFilter) {
  const mf = macFilter || { mode: 'BLACKLIST', blacklist: [], whitelist: [] };
  const blMap = new Map();
  (mf.blacklist || []).forEach(item => {
    const m = normalizeMacAddress(item.mac || item);
    if (m) blMap.set(m, typeof item === 'object' ? item : { mac: m, name: 'Blocked Device' });
  });
  const wlSet = new Set();
  (mf.whitelist || []).forEach(item => {
    const m = normalizeMacAddress(item.mac || item);
    if (m) wlSet.add(m);
  });

  const seenMacs = new Set();
  const merged = (rawDevices || []).map(d => {
    const normMac = normalizeMacAddress(d.mac);
    seenMacs.add(normMac);
    const inBl = blMap.has(normMac);
    const inWl = wlSet.has(normMac);
    const isBlocked = Boolean(d.blocked) || inBl || (mf.mode === 'WHITELIST' && wlSet.size > 0 && !inWl);
    return {
      ...d,
      mac: normMac || d.mac,
      blocked: isBlocked,
      inBlacklist: inBl,
      inWhitelist: inWl
    };
  });

  for (const [mac, blEntry] of blMap.entries()) {
    if (!seenMacs.has(mac)) {
      merged.push({
        id: `bl-${mac.replace(/:/g, '')}`,
        name: blEntry.name || 'Blocked Device',
        ip: blEntry.ip || 'محظور (غير متصل)',
        mac,
        interface: blEntry.interface || 'Wi-Fi',
        band: blEntry.band || 'Wi-Fi',
        ssid: blEntry.ssid || 'Blacklist ACL',
        rssi: -95,
        leaseTime: 'Blocked',
        online: false,
        blocked: true,
        inBlacklist: true,
        inWhitelist: wlSet.has(mac),
        downSpeedMbps: 0,
        upSpeedMbps: 0
      });
    }
  }
  return merged;
}

test('SessionTimeout detection handles ZTE XML and error strings', () => {
  assert.equal(isSessionTimeoutText('<ajax_response_xml_root>SessionTimeout</ajax_response_xml_root>'), true);
  assert.equal(isSessionTimeoutText('Normal router response'), false);
});

test('Wi-Fi password resolver NEVER leaks router admin login password (e.g. Ah@135790101)', () => {
  const routerAdminPass = 'Ah@135790101';
  const pollutedVault = {
    'DEV.WIFI.AP2': 'Ah@135790101',
    'SSID:iCe': 'Ah@135790101',
    'DEV.WIFI.AP6': 'MyRealWifiPass2026'
  };

  const cleanVault = sanitizeWifiPasswordVault(pollutedVault, routerAdminPass);
  assert.equal(cleanVault['DEV.WIFI.AP2'], undefined);
  assert.equal(cleanVault['SSID:iCe'], undefined);
  assert.equal(cleanVault['DEV.WIFI.AP6'], 'MyRealWifiPass2026');

  // Encrypted router value + no user-saved Wi-Fi password -> returns '' (never routerAdminPass)
  const resolvedAp2 = resolvePlaintextWifiPassword('DEV.WIFI.AP2', 'iCe', '******', cleanVault, routerAdminPass);
  assert.equal(resolvedAp2, '');

  // User-saved real Wi-Fi password -> returns 'MyRealWifiPass2026'
  const resolvedAp6 = resolvePlaintextWifiPassword('DEV.WIFI.AP6', 'eNg', 'T4KsDpW1dN+WLbNziX/a1A==', cleanVault, routerAdminPass);
  assert.equal(resolvedAp6, 'MyRealWifiPass2026');
});

test('parseZteWlanConfigFromXml accurately parses real ZTE H188A V2.1.1P1_EGO XML (Orange_IC, iCe, eNg)', () => {
  const sampleH188AXml = `
    <OBJ_WLANAP_ID>
      <Instance>
        <ParaName>_InstID</ParaName><ParaValue>DEV.WIFI.AP1</ParaValue>
        <ParaName>Enable</ParaName><ParaValue>0</ParaValue>
        <ParaName>ESSID</ParaName><ParaValue>Orange_IC</ParaValue>
        <ParaName>Hidden</ParaName><ParaValue>0</ParaValue>
        <ParaName>BeaconType</ParaName><ParaValue>WPAand11i</ParaValue>
        <ParaName>MaxStaNum</ParaName><ParaValue>32</ParaValue>
      </Instance>
      <Instance>
        <ParaName>_InstID</ParaName><ParaValue>DEV.WIFI.AP2</ParaValue>
        <ParaName>Enable</ParaName><ParaValue>1</ParaValue>
        <ParaName>ESSID</ParaName><ParaValue>iCe</ParaValue>
        <ParaName>Hidden</ParaName><ParaValue>0</ParaValue>
        <ParaName>BeaconType</ParaName><ParaValue>11i</ParaValue>
        <ParaName>MaxStaNum</ParaName><ParaValue>32</ParaValue>
      </Instance>
      <Instance>
        <ParaName>_InstID</ParaName><ParaValue>DEV.WIFI.AP5</ParaValue>
        <ParaName>Enable</ParaName><ParaValue>0</ParaValue>
        <ParaName>ESSID</ParaName><ParaValue>Orange_IC_5G</ParaValue>
        <ParaName>Hidden</ParaName><ParaValue>0</ParaValue>
        <ParaName>BeaconType</ParaName><ParaValue>WPAand11i</ParaValue>
        <ParaName>MaxStaNum</ParaName><ParaValue>32</ParaValue>
      </Instance>
      <Instance>
        <ParaName>_InstID</ParaName><ParaValue>DEV.WIFI.AP6</ParaValue>
        <ParaName>Enable</ParaName><ParaValue>1</ParaValue>
        <ParaName>ESSID</ParaName><ParaValue>eNg</ParaValue>
        <ParaName>Hidden</ParaName><ParaValue>0</ParaValue>
        <ParaName>BeaconType</ParaName><ParaValue>11i</ParaValue>
        <ParaName>MaxStaNum</ParaName><ParaValue>32</ParaValue>
      </Instance>
    </OBJ_WLANAP_ID>
    <OBJ_WLANCONFIGDRV_ID>
      <Instance>
        <ParaName>_InstID</ParaName><ParaValue>DEV.WIFI.AP2</ParaValue>
        <ParaName>BSSID</ParaName><ParaValue>38:d8:2f:a5:53:72</ParaValue>
        <ParaName>RealChannel</ParaName><ParaValue>1</ParaValue>
      </Instance>
      <Instance>
        <ParaName>_InstID</ParaName><ParaValue>DEV.WIFI.AP6</ParaValue>
        <ParaName>BSSID</ParaName><ParaValue>38:d8:2f:a5:53:76</ParaValue>
        <ParaName>RealChannel</ParaName><ParaValue>36</ParaValue>
      </Instance>
    </OBJ_WLANCONFIGDRV_ID>
    <OBJ_WLANSETTING_ID>
      <Instance>
        <ParaName>_InstID</ParaName><ParaValue>DEV.WIFI.RD1</ParaValue>
        <ParaName>Band</ParaName><ParaValue>2.4GHz</ParaValue>
        <ParaName>BandWidth</ParaName><ParaValue>20/40MHz</ParaValue>
        <ParaName>TxPower</ParaName><ParaValue>100%</ParaValue>
        <ParaName>Channel</ParaName><ParaValue>1</ParaValue>
      </Instance>
      <Instance>
        <ParaName>_InstID</ParaName><ParaValue>DEV.WIFI.RD2</ParaValue>
        <ParaName>Band</ParaName><ParaValue>5GHz</ParaValue>
        <ParaName>BandWidth</ParaName><ParaValue>80MHz</ParaValue>
        <ParaName>TxPower</ParaName><ParaValue>100%</ParaValue>
        <ParaName>Channel</ParaName><ParaValue>36</ParaValue>
      </Instance>
    </OBJ_WLANSETTING_ID>
    <OBJ_WLANPSK_ID>
      <Instance>
        <ParaName>_InstID</ParaName><ParaValue>DEV.WIFI.AP2</ParaValue>
        <ParaName>KeyPassphrase</ParaName><ParaValue>******</ParaValue>
      </Instance>
      <Instance>
        <ParaName>_InstID</ParaName><ParaValue>DEV.WIFI.AP6</ParaValue>
        <ParaName>KeyPassphrase</ParaName><ParaValue>******</ParaValue>
      </Instance>
    </OBJ_WLANPSK_ID>
  `;

  const ssids = parseZteWlanConfigFromXml(sampleH188AXml, {}, 'Ah@135790101');
  assert.equal(ssids.length, 4);

  const ap1 = ssids.find(s => s.slot === 1);
  assert.equal(ap1.ssid, 'Orange_IC');
  assert.equal(ap1.enabled, false);
  assert.equal(ap1.hidden, false);

  const ap2 = ssids.find(s => s.slot === 2);
  assert.equal(ap2.ssid, 'iCe');
  assert.equal(ap2.enabled, true);
  assert.equal(ap2.hidden, false);
  assert.equal(ap2.bssid, '38:d8:2f:a5:53:72');
  assert.equal(ap2.channelWidth, '20/40MHz');
  assert.equal(ap2.password, '');
  assert.equal(ap2.hasRouterEncryptedPass, true);

  const ap6 = ssids.find(s => s.slot === 6);
  assert.equal(ap6.ssid, 'eNg');
  assert.equal(ap6.enabled, true);
  assert.equal(ap6.hidden, false);
  assert.equal(ap6.bssid, '38:d8:2f:a5:53:76');
  assert.equal(ap6.channelWidth, '80MHz');
});

test('buildZteSsidPostPayload constructs complete ZTE CGILua parameters', () => {
  const payload = buildZteSsidPostPayload('DEV.WIFI.AP2', 'DEV.WIFI.AP2', {
    ssid: 'iCe_Fast',
    enabled: true,
    hidden: false,
    security: '11i',
    maxClients: 24,
    password: 'NewStrongPassword99'
  }, '12345678');

  assert.equal(payload._InstID, 'DEV.WIFI.AP2');
  assert.equal(payload.ESSID, 'iCe_Fast');
  assert.equal(payload.Hidden, '0');
  assert.equal(payload.SSIDAdvertisementEnabled, '1');
  assert.equal(payload.MaxStaNum, '24');
  assert.equal(payload.KeyPassphrase, 'NewStrongPassword99');
  assert.equal(payload._sessionTOKEN, '12345678');
});

test('mergeDevicesWithMacFilter persists blocked state across router polls and retains offline blocked devices', () => {
  const livePollDevices = [
    { id: '1', name: 'Galaxy-A54', ip: '192.168.1.2', mac: 'aa:bb:cc:11:22:33', online: true, blocked: false },
    { id: '2', name: 'My-Laptop', ip: '192.168.1.3', mac: 'dd:ee:ff:44:55:66', online: true, blocked: false }
  ];

  const macFilter = {
    mode: 'BLACKLIST',
    blacklist: [
      { mac: 'AA:BB:CC:11:22:33', name: 'Galaxy-A54', ip: '192.168.1.2' },
      { mac: '99:88:77:66:55:44', name: 'Intruder-Phone', ip: '192.168.1.99' }
    ],
    whitelist: [
      { mac: 'DD:EE:FF:44:55:66', name: 'My-Laptop' }
    ]
  };

  const merged = mergeDevicesWithMacFilter(livePollDevices, macFilter);
  assert.equal(merged.length, 3);

  const galaxy = merged.find(d => d.mac === 'AA:BB:CC:11:22:33');
  assert.equal(galaxy.blocked, true);
  assert.equal(galaxy.inBlacklist, true);

  const intruder = merged.find(d => d.mac === '99:88:77:66:55:44');
  assert.equal(intruder.blocked, true);
  assert.equal(intruder.online, false);

  const laptop = merged.find(d => d.mac === 'DD:EE:FF:44:55:66');
  assert.equal(laptop.blocked, false);
  assert.equal(laptop.inWhitelist, true);
});
