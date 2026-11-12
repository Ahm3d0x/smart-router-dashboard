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
  if (/^[A-Za-z0-9+/]{22}==$/.test(s)) return true;
  if (/^[A-Za-z0-9+/]{16,}={1,2}$/.test(s) && /[+/]/.test(s)) return true;
  return false;
}

function resolvePlaintextWifiPassword(instId, ssid, candidatePass, vault, account) {
  const cleanCand = (!isZteEncryptedOrMaskedPass(candidatePass)) ? String(candidatePass || '').trim() : '';
  if (cleanCand) return cleanCand;
  if (instId && vault[instId] && !isZteEncryptedOrMaskedPass(vault[instId])) {
    return vault[instId];
  }
  if (ssid && vault['SSID:' + ssid] && !isZteEncryptedOrMaskedPass(vault['SSID:' + ssid])) {
    return vault['SSID:' + ssid];
  }
  if (account && account.password && String(account.password).trim().length >= 8 && !['admin', 'user', 'vodafone', 'etisalat'].includes(String(account.password).trim().toLowerCase())) {
    return String(account.password).trim();
  }
  return '';
}

test('SessionTimeout detection handles ZTE XML and error strings', () => {
  assert.equal(isSessionTimeoutText('<ajax_response_xml_root>SessionTimeout</ajax_response_xml_root>'), true);
  assert.equal(isSessionTimeoutText('Normal router response'), false);
});

test('ZTE AES Base64 cipher block is filtered while real plaintext Wi-Fi password is shown', () => {
  assert.equal(isZteEncryptedOrMaskedPass('T4KsDpW1dN+WLbNziX/a1A=='), true);
  assert.equal(isZteEncryptedOrMaskedPass('MyHomeWifi2026'), false);

  const vault = { 'DEV.WIFI.AP1': 'OrangeRealPass123' };
  const resolved = resolvePlaintextWifiPassword('DEV.WIFI.AP1', 'iCe', 'T4KsDpW1dN+WLbNziX/a1A==', vault, { password: 'StickerPass99' });
  assert.equal(resolved, 'OrangeRealPass123');

  const stickerFallback = resolvePlaintextWifiPassword('DEV.WIFI.AP5', 'eNg', '', {}, { password: 'StickerPass99' });
  assert.equal(stickerFallback, 'StickerPass99');
});
