const BATCH100_EXTRA = [
  {
    id: 'console-password',
    devs: ['Switch', 'Router', '防火墙'],
    name: 'console 口密码（配置 / 修改 / 清除）',
    kw: [
      'console密码', 'console 密码', 'console口密码', '改console密码', 'console口密码忘了', 'console密码怎么改',
      'console认证', 'console口设置密码', '串口密码', '远程改console密码', '登录密码', '线路密码',
      'console密码忘了怎么改', 'console不需要密码', 'console免密', '免密登录console'
    ],
    cmds: [
      ['华为 VRP', 'system-view\nuser-interface console 0\n authentication-mode password\n set authentication password cipher Huawei@123'],
      ['思科 IOS', 'configure terminal\nline console 0\n password Cisco@123\n login'],
      ['H3C Comware', 'system-view\nline console 0\n authentication-mode password\n set authentication password simple H3C@123'],
      ['锐捷 RGOS', 'configure terminal\nline console 0\n password Ruijie@123\n login'],
      ['远程登录后改 console 密码', '! console 和 vty 是两套独立配置，改 vty 不影响 console\n! 已经能 telnet / ssh 进来，就直接在设备上改，不用去机房断电\n华为：\nsystem-view\n user-interface console 0\n  authentication-mode password\n  set authentication password cipher 新密码\n思科：\nconfigure terminal\n line console 0\n  password 新密码\n  login\n! 改完不影响当前远程会话，下一次从 console 登录才用新密码'],
      ['清掉 console 密码（免密登录）', '华为：user-interface console 0 / undo authentication-mode\n思科：line console 0 / no password / no login\n! 只有机房里物理隔离的设备才这么干，办公区绝对不能免密']
    ],
    tip: 'console 和 vty 是两条完全独立的线路，各配各的密码。所以「远程能登录但 console 密码忘了」完全可以远程把 console 密码改掉，不用去机房拆机、也不用走 BootROM 恢复。'
  },
  {
    id: 'vty-password',
    devs: ['Switch', 'Router', '防火墙'],
    name: 'Telnet / vty 密码登录（password 模式）',
    kw: ['telnet密码', 'vty密码', 'telnet密码认证', '配置telnet密码', 'telnet登录密码', 'vty认证',
      'password认证', 'telnet怎么设密码', '远程登录密码', '改telnet密码'],
    cmds: [
      ['华为 VRP', 'system-view\nuser-interface vty 0 4\n authentication-mode password\n set authentication password cipher Huawei@123\n user privilege level 15'],
      ['思科 IOS', 'configure terminal\nline vty 0 4\n password Cisco@123\n login\n privilege level 15'],
      ['H3C Comware', 'system-view\nline vty 0 4\n authentication-mode password\n set authentication password simple H3C@123\n user-role network-admin'],
      ['锐捷 RGOS', 'configure terminal\nline vty 0 4\n password Ruijie@123\n login\n privilege level 15'],
      ['password 模式 与 aaa 模式的区别', 'password 模式：所有管理员共用一个密码，只验密码不验身份\n aaa 模式：账号 + 密码 + 权限，能对应到具体的人\n由 authentication-mode 决定用哪个，两者只能生效一个'],
      ['改完要确认', 'display current-configuration | include authentication-mode\nshow running-config | section line vty\n! 确认改的是 vty 不是 console，两者视图名字很像']
    ],
    tip: 'password 模式全公司共用一个密码，出了事查不到人，等保 2.0 明确要求整改。新网一律用 aaa 模式，password 模式只在临时调试或老设备上凑合用。'
  },
  {
    id: 'enable-password',
    devs: ['Switch', 'Router'],
    name: 'enable / super 特权密码',
    kw: ['enable密码', 'enable密码配置', 'super密码', '特权密码', '提权密码', 'enable secret',
      'enable password', '改enable密码', 'super口令'],
    cmds: [
      ['思科 IOS', 'enable secret Cisco@123\n! 加密存储，show run 看不到明文，优先用这个\nenable password Cisco@123\n! 明文存储，show run 直接能看到，不要用'],
      ['华为 VRP', 'super password cipher Huawei@123\n! 指定用户级别\nsuper password level 3 cipher Huawei@123'],
      ['H3C Comware', 'super password simple H3C@123\n! 对应角色级别\nsuper password role network-admin simple H3C@123'],
      ['锐捷 RGOS', 'enable secret Ruijie@123'],
      ['两个都配了会怎样', '思科：enable secret 和 enable password 同时存在时，只有 secret 生效\n这也是「改了密码不生效」最常见的原因——改的是 password，secret 还在'],
      ['验证', '思科：show running-config | include enable\n华为：display current-configuration | include super\n! 确认只有一条生效，别留两条打架']
    ],
    tip: 'enable password 在 show run 里是明文，谁都能看到，等于没设密码。只要设备支持 enable secret，就一定用 secret。'
  }
];
module.exports = { BATCH100_EXTRA };
