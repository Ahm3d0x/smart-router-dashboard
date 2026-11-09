/**
 * Modular DOM & API Selector Maps for All Egyptian ISP Gateways
 * Supports: WE (Telecom Egypt), Orange Egypt, Vodafone Egypt, e& (Etisalat) Egypt, Noor DSL
 * Hardware: ZTE (H188A, H288A, H168N, H108N), Huawei (DN8245V, DG8045, HG630 V2, HG633, HG531), TP-Link (VN020-F3, VR600), Nokia (G-2425G-A)
 */
const ZTE_COMMON = {
  name: 'ZTE ZXHN H188A / H288A / H168N (WE / Orange / Vodafone / e&)',
  login: {
    usernameInput: '#Frm_Username, input[name="Username"], #username',
    passwordInput: '#Frm_Password, input[name="Password"], #password',
    submitButton: '#LoginId, #loginBtn, input[type="submit"], button[type="submit"]',
    errorIndicator: '#errnote, .error-tip, #login_error, #LoginError',
    loggedInCheck: '#logout, #mmManager, .main-menu, #mmHome, #top_menu'
  },
  navigation: {
    statusTab: '#mmStatus, a[href*="status"], #smStatus',
    dslSubTab: '#smDSL, #ssmDSL, #dslWanStatus, #wanStatus',
    lanSubTab: '#smLAN, #ssmLANHost, #localNetStatus',
    wlanTab: '#mmNet, #smWLAN, #wlanBasic',
    macFilterSubTab: '#ssmMacFilter, #smWlanMacFilter, #wlanAdvanced',
    managementTab: '#mmManager, #statusMgr',
    rebootSubTab: '#smSysMgr, #ssmRestart, #restartMgr'
  },
  status: {
    model: '#ModelName, [id*="ModelName"]',
    firmware: '#SoftwareVer, [id*="SoftwareVer"], [id*="SwVer"]',
    uptime: '#UpTime, #PowerOnTime, [id*="UpTime"], [id*="PowerOnTime"]',
    wanStatus: '#ConnStatus, [id*="ConnStatus"], [id*="Status"]',
    wanIp: '#IPAddress, [id*="WanIP"], [id*="IPAddress"]',
    dslDownSync: '#DownstreamCurrRate, #Downstream_current_rate, [id*="DownCurrRate"], [id*="Downstream_current_rate"]',
    dslUpSync: '#UpstreamCurrRate, #Upstream_current_rate, [id*="UpCurrRate"], [id*="Upstream_current_rate"]',
    snrDown: '#DownstreamNoiseMargin, #Downstream_noise_margin, [id*="DownSNR"], [id*="Downstream_noise_margin"]',
    snrUp: '#UpstreamNoiseMargin, #Upstream_noise_margin, [id*="UpSNR"], [id*="Upstream_noise_margin"]',
    attenDown: '#DownstreamAttenuation, #Downstream_attenuation, [id*="DownAtten"], [id*="Downstream_attenuation"]',
    attenUp: '#UpstreamAttenuation, #Upstream_attenuation, [id*="UpAtten"], [id*="Upstream_attenuation"]'
  },
  devices: {
    rowSelector: 'table[id*="LanHost"] tr, table[id*="accessdev"] tr, .host-list-row',
    hostnameCell: 'td:nth-child(1), .host-name, [id*="HostName"]',
    ipCell: 'td:nth-child(2), .host-ip, [id*="IPAddress"]',
    macCell: 'td:nth-child(3), .host-mac, [id*="MACAddress"]',
    interfaceCell: 'td:nth-child(4), .host-port, [id*="AliasName"]'
  },
  wifi: {
    band24: {
      ssidInput: '#ESSID, #Frm_SSID1, [id*="ESSID"]:not([id*="5G"])',
      passwordInput: '#KeyPassphrase, #Frm_KeyPassphrase1, [id*="KeyPassphrase"]:not([id*="5G"])',
      hideSsidCheckbox: '#HideSSID, #Frm_HideSSID1',
      txPowerSelect: '#TxPower, #Frm_TxPower1, # transmittingPower',
      channelWidthSelect: '#BandWidth, #Frm_BandWidth1',
      saveButton: '#Btn_apply_wlan, #Btn_Submit, [id^="Btn_apply"]'
    },
    band5: {
      ssidInput: '#ESSID_5G, #Frm_SSID5, #ESSID1',
      passwordInput: '#KeyPassphrase_5G, #Frm_KeyPassphrase5, #KeyPassphrase1',
      hideSsidCheckbox: '#HideSSID_5G, #Frm_HideSSID5',
      txPowerSelect: '#TxPower_5G, #Frm_TxPower5',
      channelWidthSelect: '#BandWidth_5G, #Frm_BandWidth5',
      saveButton: '#Btn_apply_wlan5, #Btn_Submit, [id^="Btn_apply"]'
    }
  },
  macFilter: {
    modeSelect: '#FilterMode, #Frm_MacFilterMode',
    addButton: '#Btn_AddMacFilter, #addInstBar',
    macInput: '#MacAddr, #Frm_MacAddr, #MACAddress',
    applyButton: '#Btn_ApplyMacFilter, #Btn_Submit, #Btn_apply',
    deleteButtonPrefix: '[id^="Btn_Delete_"], .del-btn'
  },
  reboot: {
    triggerButton: '#Btn_restart, #Submit_Reboot',
    confirmButton: '#confirmOK, .ui-dialog-buttonset button:first-child, #msgconfirmb'
  }
};

const HUAWEI_COMMON = {
  name: 'Huawei DN8245V / DG8045 / HG630 V2 / HG633 / HG531 (WE / Orange / Vodafone / e&)',
  login: {
    usernameInput: '#txt_Username, #user_name, #username, input[name="Username"]',
    passwordInput: '#txt_Password, #password, input[name="Password"]',
    submitButton: '#button, #loginbutton, #login_btn, #btnLogin',
    errorIndicator: '#DivErrPage, #login_error_hint, .login_error',
    loggedInCheck: '#headerLogoutText, #menuIframe, #logout_span, #nav_status'
  },
  navigation: {
    statusTab: '#name_wanstatus, #status_icon, #nav_status',
    dslSubTab: '#dslinfo, #wan_dsl_status',
    lanSubTab: '#userdevinfo, #dhcpinfo, #home_devices',
    wlanTab: '#name_wlanconfig, #wifi_icon, #nav_wifi',
    macFilterSubTab: '#wlanmacfilter, #wifi_macfilter',
    managementTab: '#name_maintaininfo, #sys_icon, #nav_maintain',
    rebootSubTab: '#resetinstall, #sys_reboot'
  },
  status: {
    model: '#tdProductName, #SpanProductName, #device_model',
    firmware: '#tdSoftwareVersion, #SpanSwVer, #software_version',
    uptime: '#tdUpTime, #SpanSysTime, #system_uptime',
    wanStatus: '#tdWanStatus, #internet_status',
    wanIp: '#tdWanIp, #wan_ip_address',
    dslDownSync: '#tdDownStreamRate, #dsl_down_rate',
    dslUpSync: '#tdUpStreamRate, #dsl_up_rate',
    snrDown: '#tdDownNoiseMargin, #dsl_down_snr',
    snrUp: '#tdUpNoiseMargin, #dsl_up_snr',
    attenDown: '#tdDownAttenuation, #dsl_down_atten',
    attenUp: '#tdUpAttenuation, #dsl_up_atten'
  },
  devices: {
    rowSelector: '#tbluserdevinfo tr.tabal_01, .DevTable tr, .device_list_tr',
    hostnameCell: 'td:nth-child(1), .dev_name',
    ipCell: 'td:nth-child(3), .dev_ip',
    macCell: 'td:nth-child(2), .dev_mac',
    interfaceCell: 'td:nth-child(4), .dev_port'
  },
  wifi: {
    band24: {
      ssidInput: '#wlSsid_2G, #txt_ssid_2g, #ssid_2g_input',
      passwordInput: '#wlWpaPsk_2G, #pwd_ssidpassword_2g, #wpa_psk_2g',
      hideSsidCheckbox: '#wlHide_2G, #cb_hidessid_2g',
      txPowerSelect: '#wlTxPower_2G, #tx_power_2g',
      channelWidthSelect: '#wlBandWidth_2G, #bandwidth_2g',
      saveButton: '#btnApply_2G, #btnApplyWlan, #save_wifi_btn'
    },
    band5: {
      ssidInput: '#wlSsid_5G, #txt_ssid_5g, #ssid_5g_input',
      passwordInput: '#wlWpaPsk_5G, #pwd_ssidpassword_5g, #wpa_psk_5g',
      hideSsidCheckbox: '#wlHide_5G, #cb_hidessid_5g',
      txPowerSelect: '#wlTxPower_5G, #tx_power_5g',
      channelWidthSelect: '#wlBandWidth_5G, #bandwidth_5g',
      saveButton: '#btnApply_5G, #btnApplyWlan5, #save_wifi_btn'
    }
  },
  macFilter: {
    modeSelect: '#FilterMode',
    addButton: '#Newbutton, #add_mac_btn',
    macInput: '#SourceMACAddress, #mac_address_input',
    applyButton: '#btnApply_ex, #save_mac_btn',
    deleteButtonPrefix: 'input[name="rml"]'
  },
  reboot: {
    triggerButton: '#btnReboot, #reboot_btn',
    confirmButton: '#btnConfirm, #confirm_ok'
  }
};

const TPLINK_COMMON = {
  name: 'TP-Link VN020-F3 / Archer VR600 / VR400 / TD-W9960 (WE / e&)',
  login: {
    usernameInput: '#userName, #pc-login-user, input.tp-input-text',
    passwordInput: '#pcPassword, #pc-login-password, input[type="password"]',
    submitButton: '#loginBtn, #pc-login-btn, button.button-button',
    errorIndicator: '#errNote, #login-err-msg, .error-tips-content',
    loggedInCheck: '#top-control-logout, #logout, #mainBody'
  },
  navigation: {
    statusTab: '#menu_status, a[url*="status"]',
    dslSubTab: '#menu_dsl, #status_dsl',
    lanSubTab: '#menu_network, #menu_client',
    wlanTab: '#menu_wl2g, #menu_wireless',
    macFilterSubTab: '#menu_wlmacfilter',
    managementTab: '#menu_tools',
    rebootSubTab: '#menu_restart'
  },
  status: {
    model: '#modelName, #product-name, #bot_hver',
    firmware: '#softVersion, #bot_sver',
    uptime: '#upTime, #runtime',
    wanStatus: '#wanStatus, #internet_status',
    wanIp: '#wanIp, #internet_ip',
    dslDownSync: '#dsl_down_rate, #downstreamCurrRate',
    dslUpSync: '#dsl_up_rate, #upstreamCurrRate',
    snrDown: '#dsl_snr_down, #downstreamNoiseMargin',
    snrUp: '#dsl_snr_up, #upstreamNoiseMargin',
    attenDown: '#dsl_atten_down, #downstreamAttenuation',
    attenUp: '#dsl_atten_up, #upstreamAttenuation'
  },
  devices: {
    rowSelector: '#hostTbl tr, table.table-content tr',
    hostnameCell: 'td:nth-child(2)',
    ipCell: 'td:nth-child(3)',
    macCell: 'td:nth-child(4)',
    interfaceCell: 'td:nth-child(5)'
  },
  wifi: {
    band24: {
      ssidInput: '#ssid, #ssid_2g',
      passwordInput: '#wpa2PersonalPwd, #pskSecret_2g',
      hideSsidCheckbox: '#hideSsid',
      txPowerSelect: '#transmitPower',
      channelWidthSelect: '#chnwidth',
      saveButton: '#saveBtn, button.T_save'
    },
    band5: {
      ssidInput: '#ssid_5g',
      passwordInput: '#wpa2PersonalPwd_5g, #pskSecret_5g',
      hideSsidCheckbox: '#hideSsid_5g',
      txPowerSelect: '#transmitPower_5g',
      channelWidthSelect: '#chnwidth_5g',
      saveButton: '#saveBtn_5g, button.T_save'
    }
  },
  macFilter: {
    modeSelect: '#macFilterMode',
    addButton: '#addMacBtn',
    macInput: '#macAddr',
    applyButton: '#saveMacBtn',
    deleteButtonPrefix: '.del-mac'
  },
  reboot: {
    triggerButton: '#rebootBtn, #button_reboot',
    confirmButton: '.msg-btn-ok, #confirm_yes'
  }
};

module.exports = {
  ZTE_H188A: ZTE_COMMON,
  ZTE_H168N: Object.assign({}, ZTE_COMMON, { name: 'ZTE ZXHN H168N / H108N (WE / Orange / Vodafone / e&)' }),
  HUAWEI_DN8245V: HUAWEI_COMMON,
  HUAWEI_HG630: Object.assign({}, HUAWEI_COMMON, { name: 'Huawei HG630 V2 / HG633 / DG8045 / HG531 (Vodafone / Orange / WE / e&)' }),
  TPLINK_VN020: TPLINK_COMMON,
  NOKIA_G2425G: Object.assign({}, HUAWEI_COMMON, { name: 'Nokia G-2425G-A Fiber FTTH (WE / Telecom Egypt)' }),
  HUAWEI_4G_HILINK: Object.assign({}, HUAWEI_COMMON, { name: 'Huawei HiLink 4G Home B310 / B315 / B535 (Orange / Vodafone / WE / e&)' }),
  AUTO_DETECT: Object.assign({}, ZTE_COMMON, { name: 'Auto-Detect Egyptian ISP Gateway (ZTE / Huawei / TP-Link / Nokia)' })
};

