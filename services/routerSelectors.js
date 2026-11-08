/**
 * Modular DOM & API Selector Maps for Common ISP Gateways (WE Egypt / ZTE / Huawei).
 * Easily tweak selectors here if your firmware revision differs.
 */
module.exports = {
  ZTE_H188A: {
    name: 'ZTE ZXHN H188A (WE Egypt)',
    login: {
      usernameInput: '#Frm_Username',
      passwordInput: '#Frm_Password',
      submitButton: '#LoginId',
      errorIndicator: '#errnote, .error-tip',
      loggedInCheck: '#logout, #mmManager, .main-menu'
    },
    navigation: {
      statusTab: '#mmStatus, a[href*="status"]',
      dslSubTab: '#smDSL, #ssmDSL',
      lanSubTab: '#smLAN, #ssmLANHost',
      wlanTab: '#mmNet, #smWLAN',
      macFilterSubTab: '#ssmMacFilter, #smWlanMacFilter',
      managementTab: '#mmManager',
      rebootSubTab: '#smSysMgr, #ssmRestart'
    },
    status: {
      model: '#ModelName, [id*="ModelName"]',
      firmware: '#SoftwareVer, [id*="SoftwareVer"]',
      uptime: '#UpTime, [id*="UpTime"]',
      wanStatus: '#ConnStatus, [id*="ConnStatus"]',
      wanIp: '#IPAddress, [id*="WanIP"]',
      dslDownSync: '#DownstreamCurrRate, [id*="DownCurrRate"]',
      dslUpSync: '#UpstreamCurrRate, [id*="UpCurrRate"]',
      snrDown: '#DownstreamNoiseMargin, [id*="DownSNR"]',
      snrUp: '#UpstreamNoiseMargin, [id*="UpSNR"]',
      attenDown: '#DownstreamAttenuation, [id*="DownAtten"]',
      attenUp: '#UpstreamAttenuation, [id*="UpAtten"]'
    },
    devices: {
      rowSelector: 'table[id*="LanHost"] tr, .host-list-row',
      hostnameCell: 'td:nth-child(1), .host-name',
      ipCell: 'td:nth-child(2), .host-ip',
      macCell: 'td:nth-child(3), .host-mac',
      interfaceCell: 'td:nth-child(4), .host-port'
    },
    wifi: {
      band24: {
        ssidInput: '#ESSID, #Frm_SSID1',
        passwordInput: '#KeyPassphrase, #Frm_KeyPassphrase1',
        hideSsidCheckbox: '#HideSSID, #Frm_HideSSID1',
        txPowerSelect: '#TxPower, #Frm_TxPower1',
        channelWidthSelect: '#BandWidth, #Frm_BandWidth1',
        saveButton: '#Btn_apply_wlan, #Btn_Submit'
      },
      band5: {
        ssidInput: '#ESSID_5G, #Frm_SSID5',
        passwordInput: '#KeyPassphrase_5G, #Frm_KeyPassphrase5',
        hideSsidCheckbox: '#HideSSID_5G, #Frm_HideSSID5',
        txPowerSelect: '#TxPower_5G, #Frm_TxPower5',
        channelWidthSelect: '#BandWidth_5G, #Frm_BandWidth5',
        saveButton: '#Btn_apply_wlan5, #Btn_Submit'
      }
    },
    macFilter: {
      modeSelect: '#FilterMode, #Frm_MacFilterMode',
      addButton: '#Btn_AddMacFilter',
      macInput: '#MacAddr, #Frm_MacAddr',
      applyButton: '#Btn_ApplyMacFilter, #Btn_Submit',
      deleteButtonPrefix: '[id^="Btn_Delete_"]'
    },
    reboot: {
      triggerButton: '#Btn_restart, #Submit_Reboot',
      confirmButton: '#confirmOK, .ui-dialog-buttonset button:first-child'
    }
  },

  HUAWEI_DN8245V: {
    name: 'Huawei EchoLife DN8245V / HG8245H (WE Egypt)',
    login: {
      usernameInput: '#txt_Username',
      passwordInput: '#txt_Password',
      submitButton: '#button, #loginbutton',
      errorIndicator: '#DivErrPage',
      loggedInCheck: '#headerLogoutText, #menuIframe'
    },
    navigation: {
      statusTab: '#name_wanstatus, #status_icon',
      dslSubTab: '#dslinfo',
      lanSubTab: '#userdevinfo, #dhcpinfo',
      wlanTab: '#name_wlanconfig, #wifi_icon',
      macFilterSubTab: '#wlanmacfilter',
      managementTab: '#name_maintaininfo, #sys_icon',
      rebootSubTab: '#resetinstall'
    },
    status: {
      model: '#tdProductName, #SpanProductName',
      firmware: '#tdSoftwareVersion, #SpanSwVer',
      uptime: '#tdUpTime, #SpanSysTime',
      wanStatus: '#tdWanStatus',
      wanIp: '#tdWanIp',
      dslDownSync: '#tdDownStreamRate',
      dslUpSync: '#tdUpStreamRate',
      snrDown: '#tdDownNoiseMargin',
      snrUp: '#tdUpNoiseMargin',
      attenDown: '#tdDownAttenuation',
      attenUp: '#tdUpAttenuation'
    },
    devices: {
      rowSelector: '#tbluserdevinfo tr.tabal_01, .DevTable tr',
      hostnameCell: 'td:nth-child(1)',
      ipCell: 'td:nth-child(3)',
      macCell: 'td:nth-child(2)',
      interfaceCell: 'td:nth-child(4)'
    },
    wifi: {
      band24: {
        ssidInput: '#wlSsid_2G, #txt_ssid_2g',
        passwordInput: '#wlWpaPsk_2G, #pwd_ssidpassword_2g',
        hideSsidCheckbox: '#wlHide_2G, #cb_hidessid_2g',
        txPowerSelect: '#wlTxPower_2G',
        channelWidthSelect: '#wlBandWidth_2G',
        saveButton: '#btnApply_2G, #btnApplyWlan'
      },
      band5: {
        ssidInput: '#wlSsid_5G, #txt_ssid_5g',
        passwordInput: '#wlWpaPsk_5G, #pwd_ssidpassword_5g',
        hideSsidCheckbox: '#wlHide_5G, #cb_hidessid_5g',
        txPowerSelect: '#wlTxPower_5G',
        channelWidthSelect: '#wlBandWidth_5G',
        saveButton: '#btnApply_5G, #btnApplyWlan5'
      }
    },
    macFilter: {
      modeSelect: '#FilterMode',
      addButton: '#Newbutton',
      macInput: '#SourceMACAddress',
      applyButton: '#btnApply_ex',
      deleteButtonPrefix: 'input[name="rml"]'
    },
    reboot: {
      triggerButton: '#btnReboot',
      confirmButton: '#btnConfirm'
    }
  }
};
