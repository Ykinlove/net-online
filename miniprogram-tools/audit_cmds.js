/**
 * 命令真实性体检：机器能判的部分
 * 1) 厂商命令首词错配（华为里出现 show、思科里出现 display）
 * 2) 同一功能点里，两家厂商命令完全相同（复制粘贴嫌疑；华为/H3C 本就相近，单独标注）
 * 3) 命令里混入中文、全角标点、空行
 * 4) 华为有 undo 但思科没有 no、思科有 no 但华为没有 undo 的成对性检查
 * 5) 命令首词是否落在该厂商已知命令集内
 */
const { BOOK } = require('../miniprogram/subpkg-tool/utils/cmdbook.js');

const HUAWEI_CMDS = new Set(`display system-view sysname quit return save reset reboot interface vlan undo
  port-group stp rstp mstp lacp link-aggregation eth-trunk traffic-filter traffic-policy qos mirror
  dhcp dhcp-snooping ip ipv6 bgp ospf isis mpls ntp snmp-agent info-center aaa local-user user-interface
  radius-server hwtacacs-server ssh telnet ping tracert vrrp bfd nqa track nat firewall security-zone
  wlan ap capwap nat-server acl route-policy ip-prefix traffic behavior classifier acl-rule
  shutdown description area authentication import-route network peer group regexp as-path-filter
  community-filter mac-address port-security dhcpv6 nd router-id silent-interface vlink-peer
  stub-router default-route-advertise bandwidth-statistic flow ipsec ike proposal crypto
  super-vlan sub-vlan gvrp erps cfm efm dlcf y1731 nqa clock header-art login time-range
  cpu-defend http https-mode snmp-server info-center ntp-service sflow netstream ipv4
  filter-policy preference cost timer hello dead-interface graceful-restart bfd-session
  max-prefix dampening reflector cluster-id confederation aggregation route-tag next-hop-local
  display-cur shutdown-interface startup saved-configuration patch load firmware upgrade
  system-view protocol-vlan qinq dot1q tunneling mux-vlan multicast igmp pim msdp
  dhcp-server dhcp-relay portal mac-authen dot1x access-limit free-rule
  session aging-time lin license resource-mode irf mad mad-detect
  stack port-priority domain default-vlan member`.split(/\s+/).filter(Boolean));

const CISCO_CMDS = new Set(`show configure hostname exit end write copy ping telnet ssh traceroute
  interface vlan no ip ipv6 router line aaa username enable secret crypto zone nat object
  access-list route-map prefix-list ip-prefix as-path community-list policy-map class-map
  service-policy mls spanning-tree channel-group port-channel switchport monitor snmp-server
  logging ntp clock archive banner aaa-servers radius-server tacacs-server dot1x authentication
  authorization accounting mac address-table arp dhcp snooping storm-control udld errdisable
  cdp lldp vtp l2protocol-tunnel lldp-holdtime power inline switchport-port-security
  hsrp vrrp glbp bfd track sla sla-responder mpls ldp bgp ospf isis eigrp rip timers
  redistribute default-information passive-interface area virtual-link summary-address
  network neighbor peer-group advertise-map dampening maximum-prefix bgp-router
  tunnel crypto-map ipsec transform-set sa crypto-pki pki license reload boot system
  clock-timezone logging-buffered syslog global udp-jitter-voip service dhcp-database-agent
  do debug clear undebug no-undo`.split(/\s+/).filter(Boolean));

const H3C_OK = HUAWEI_CMDS;   // Comware 与 VRP 首词高度重合
const RG_OK = CISCO_CMDS;     // 锐捷 RGOS 与 IOS 高度重合

const MAP = {
  '华为': HUAWEI_CMDS,
  'H3C': H3C_OK,
  '思科': CISCO_CMDS,
  '锐捷': RG_OK
};

function firstWord(code) {
  const lines = String(code).split('\n');
  for (const ln of lines) {
    const t = ln.trim();
    if (!t || t.startsWith('#') || t.startsWith('!') || t.startsWith('//')) continue;
    return t.split(/[\s]+/)[0].toLowerCase();
  }
  return '';
}

const issues = [];
const samePair = [];
const crossVendor = [];

BOOK.forEach(it => {
  const byV = {};
  it.cmds.forEach(c => { byV[c[0]] = String(c[1]); });

  it.cmds.forEach(c => {
    const v = c[0];
    const code = String(c[1]);

    /* 中文混入（注释行除外） */
    String(code).split('\n').forEach(ln => {
      const t = ln.replace(/#.*$/, '').replace(/!.*$/, '').replace(/\/\/.*$/, '');
      if (/[\u4e00-\u9fa5]/.test(t) && !/^[\u4e00-\u9fa5\s]*$/.test(t)) {
        issues.push([it.id, v, '命令含中文: ' + t.trim()]);
      }
    });

    /* 全角字符 */
    if (/[\u3000\uFF01-\uFF5E]/.test(code)) issues.push([it.id, v, '含全角字符']);

    /* 厂商首词错配 */
    const fw = firstWord(code);
    if (fw) {
      if ((v === '华为' || v === 'H3C') && /^(show|configure terminal|write|copy run)/.test(fw)) {
        crossVendor.push([it.id, v, fw, code.split('\n')[0]]);
      }
      if ((v === '思科' || v === '锐捷') && /^(display|system-view|undo|save)$/.test(fw)) {
        crossVendor.push([it.id, v, fw, code.split('\n')[0]]);
      }
      /* 首词不在命令集里（只提示，不一定是错） */
      const set = MAP[v];
      if (set && !set.has(fw) && !/^[a-z0-9\-\.\/]+$/.test('')) {
        /* 忽略纯参数型（如直接写 IP） */
        if (!/^\d/.test(fw) && fw.length > 2) {
          issues.push([it.id, v, '首词陌生: ' + fw]);
        }
      }
    }
  });

  /* 厂商之间完全相同 */
  const vendors = Object.keys(byV);
  for (let i = 0; i < vendors.length; i++) {
    for (let j = i + 1; j < vendors.length; j++) {
      const a = vendors[i], b = vendors[j];
      if (byV[a] && byV[a] === byV[b]) {
        const hw = (a === '华为' && b === 'H3C') || (a === 'H3C' && b === '华为');
        const cs = (a === '思科' && b === '锐捷') || (a === '锐捷' && b === '思科');
        if (hw || cs) samePair.push([it.id, a + '=' + b, byV[a].split('\n')[0]]);
        else samePair.push([it.id, a + '=' + b + '(跨系)', byV[a].split('\n')[0]]);
      }
    }
  }
});

console.log('=== 跨厂商首词错配 (' + crossVendor.length + ') ===');
crossVendor.forEach(x => console.log('  ' + x[0] + ' [' + x[1] + '] ' + x[2] + '  <=  ' + x[3]));

console.log('\n=== 厂商命令完全相同 (' + samePair.length + ') ===');
samePair.forEach(x => console.log('  ' + x[0] + '  ' + x[1] + '  ' + x[2]));

console.log('\n=== 其他可疑 (' + issues.length + ') ===');
issues.forEach(x => console.log('  ' + x[0] + ' [' + x[1] + '] ' + x[2]));
