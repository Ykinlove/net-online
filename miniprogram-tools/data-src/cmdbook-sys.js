// utils/cmdbook-sys.js —— 命令百科扩充：Linux / Windows / 服务器 / 其他设备
// 这类设备没有「厂商」维度，改成「发行版」或「命令行工具」两个口径。

const SYS_EXTRA = [
  /* ---------------- Linux ---------------- */
  {
    id: 'lnx-ip',
    devs: ['Linux', '服务器'],
    name: '查看 IP 地址',
    kw: ['查ip', 'ip addr', 'ifconfig', '网卡地址', '看网卡'],
    cmds: [
      ['通用', 'ip addr\n# 老系统或没装 iproute\nifconfig -a'],
      ['CentOS/RHEL', 'nmcli device show\nip -4 addr'],
      ['Ubuntu/Debian', 'ip -4 addr show\nnetplan status']
    ],
    tip: 'ifconfig 已经逐渐被淘汰，新系统用 ip addr（iproute2）。'
  },
  {
    id: 'lnx-ip-temp',
    devs: ['Linux', '服务器'],
    name: '临时配置 IP（重启失效）',
    kw: ['临时配ip', 'ip addr add', '改ip临时', '命令行配地址'],
    cmds: [
      ['通用', 'ip addr add 192.168.1.10/24 dev eth0\nip link set eth0 up\nip route add default via 192.168.1.1'],
      ['CentOS/RHEL', 'nmcli con mod eth0 ipv4.addresses 192.168.1.10/24\nnmcli con up eth0'],
      ['Ubuntu/Debian', 'ip addr add 192.168.1.10/24 dev ens33\nip route add default via 192.168.1.1']
    ],
    tip: 'ip addr add 重启就没了，临时验证没问题，要长期生效写进 netplan 或 ifcfg。'
  },
  {
    id: 'lnx-ip-perm',
    devs: ['Linux', '服务器'],
    name: '永久配置 IP',
    kw: ['永久配ip', '改ip永久', 'netplan', 'ifcfg', '网卡配置文件'],
    cmds: [
      ['CentOS 7/8', 'vi /etc/sysconfig/network-scripts/ifcfg-eth0\n BOOTPROTO=static\n IPADDR=192.168.1.10\n PREFIX=24\n GATEWAY=192.168.1.1\nsystemctl restart network'],
      ['CentOS 9 / Rocky', 'nmcli con mod eth0 ipv4.method manual\nnmcli con mod eth0 ipv4.addresses 192.168.1.10/24\nnmcli con mod eth0 ipv4.gateway 192.168.1.1\nnmcli con up eth0'],
      ['Ubuntu 18+', 'vi /etc/netplan/01-netcfg.yaml\n network:\n  ethernets:\n   ens33:\n    addresses: [192.168.1.10/24]\n    gateway4: 192.168.1.1\nnetplan apply']
    ],
    tip: '改 IP 前先确认有 console 或带外管理，改错就彻底失联了。改完一定要 `ip a` 复查再断开。'
  },
  {
    id: 'lnx-dns',
    devs: ['Linux', '服务器'],
    name: '配置 DNS',
    kw: ['dns', 'resolv.conf', '域名解析', '改dns'],
    cmds: [
      ['通用', 'vi /etc/resolv.conf\n nameserver 114.114.114.114\n nameserver 8.8.8.8'],
      ['CentOS/RHEL', 'nmcli con mod eth0 ipv4.dns "114.114.114.114 8.8.8.8"\nnmcli con up eth0'],
      ['Ubuntu/Debian', 'vi /etc/systemd/resolved.conf\n DNS=114.114.114.114 8.8.8.8\nsystemctl restart systemd-resolved']
    ],
    tip: '直接改 /etc/resolv.conf 会被 NetworkManager 覆盖，重启就没了，要用 nmcli 或 netplan 配。'
  },
  {
    id: 'lnx-route',
    devs: ['Linux', '服务器'],
    name: 'Linux 查看与添加路由',
    kw: ['路由', 'ip route', '默认网关', '加路由linux'],
    cmds: [
      ['通用', 'ip route show\nip route add 10.1.1.0/24 via 192.168.1.1'],
      ['CentOS/RHEL', 'ip route add default via 192.168.1.1\n# 永久\nvi /etc/sysconfig/network-scripts/route-eth0'],
      ['Ubuntu/Debian', 'ip route add default via 192.168.1.1\n# 永久写在 netplan 的 routes 里']
    ],
    tip: 'ip route add 重启失效。CentOS 写 route-eth0（用 -net/-gw），Ubuntu 写 netplan 的 routes。'
  },
  {
    id: 'lnx-ss',
    devs: ['Linux', '服务器'],
    name: '查看端口监听与连接',
    kw: ['端口占用', 'ss', 'netstat', '监听端口', '谁占了端口'],
    cmds: [
      ['通用', 'ss -tunlp\n# 老写法\nnetstat -tunlp'],
      ['按端口查', 'ss -tunlp | grep 8080\nlsof -i:8080'],
      ['按进程查', 'ss -tp | grep nginx']
    ],
    tip: 'ss 比 netstat 快得多，新系统多数已经不自带 netstat 了。'
  },
  {
    id: 'lnx-firewall',
    devs: ['Linux', '服务器'],
    name: 'Linux 防火墙放行端口',
    kw: ['防火墙', '放行端口', 'firewalld', 'ufw', 'iptables', '端口不通'],
    cmds: [
      ['CentOS 7+', 'firewall-cmd --permanent --add-port=8080/tcp\nfirewall-cmd --reload\nfirewall-cmd --list-ports'],
      ['Ubuntu/Debian', 'ufw allow 8080/tcp\nufw status numbered'],
      ['iptables', 'iptables -A INPUT -p tcp --dport 8080 -j ACCEPT\nservice iptables save']
    ],
    tip: '服务本地 curl 能通、外面访问不了，八成是防火墙。CentOS 用 firewalld、Ubuntu 用 ufw，别查错地方。'
  },
  {
    id: 'lnx-tcpdump',
    devs: ['Linux', '服务器'],
    name: '抓包 tcpdump',
    kw: ['抓包', 'tcpdump', '看报文', '端口抓包'],
    cmds: [
      ['通用', 'tcpdump -i any -nn port 80 -w /tmp/http.pcap'],
      ['按主机', 'tcpdump -i eth0 -nn host 192.168.1.10 and port 443'],
      ['直接看', 'tcpdump -i eth0 -nn -A port 53']
    ],
    tip: '抓完用 Wireshark 打开 .pcap 看更清楚；-w 写文件时控制台不会刷屏，别以为没抓到。'
  },
  {
    id: 'lnx-conn-test',
    devs: ['Linux', '服务器'],
    name: '测试端口连通性',
    kw: ['测试端口', 'telnet', 'nc', 'curl', '通不通'],
    cmds: [
      ['通用', 'telnet 192.168.1.10 8080\nnc -zv 192.168.1.10 8080'],
      ['HTTP 服务', 'curl -I http://192.168.1.10:8080\ncurl -v telnet://192.168.1.10:8080'],
      ['超时控制', 'nc -zv -w 3 192.168.1.10 8080']
    ],
    tip: 'nc 的 -w 一定要加，否则不通时会挂很久，排障时特别耽误事。'
  },
  {
    id: 'lnx-process',
    devs: ['Linux', '服务器'],
    name: '查看进程与资源占用',
    kw: ['进程', 'top', 'ps', 'cpu占用', '内存占用', '负载'],
    cmds: [
      ['通用', 'top\nps -ef | grep nginx\nuptime'],
      ['按 CPU 排序', 'ps aux --sort=-%cpu | head -10'],
      ['按内存排序', 'ps aux --sort=-%mem | head -10'],
      ['IO 情况', 'iostat -x 1']
    ],
    tip: '关注 load average 要和核数比，8 核跑出 load 8 才算满，1 分钟负载刚过 4 核数不用慌。'
  },
  {
    id: 'lnx-log',
    devs: ['Linux', '服务器'],
    name: '查看系统与服务日志',
    kw: ['日志', 'journalctl', 'tail', '看错误日志', '排查日志'],
    cmds: [
      ['systemd', 'journalctl -u nginx -n 200 --no-pager\njournalctl -xe'],
      ['文件日志', 'tail -f /var/log/messages\ntail -n 100 /var/log/syslog'],
      ['关键字过滤', 'grep -i error /var/log/nginx/error.log | tail -50']
    ],
    tip: 'CentOS 的通用日志在 /var/log/messages，Ubuntu 在 /var/log/syslog，找错文件会以为没日志。'
  },
  {
    id: 'lnx-systemctl',
    devs: ['Linux', '服务器'],
    name: '服务管理 systemctl',
    kw: ['启动服务', 'systemctl', '开机自启', '重启服务', '服务挂了'],
    cmds: [
      ['通用', 'systemctl status nginx\nsystemctl restart nginx\nsystemctl enable --now nginx'],
      ['查看失败项', 'systemctl --failed'],
      ['查看依赖', 'systemctl list-dependencies nginx']
    ],
    tip: 'start 只是这次启动，enable 才是开机自启。两个都做用 enable --now。'
  },
  {
    id: 'lnx-nic-speed',
    devs: ['Linux', '服务器'],
    name: '查看网卡速率与光模块',
    kw: ['网卡速率', 'ethtool', '千兆百兆', '双工', '光模块'],
    cmds: [
      ['通用', 'ethtool eth0\nethtool -S eth0 | grep -i error'],
      ['光模块', 'ethtool -m eth0'],
      ['链路协商', 'ethtool -s eth0 speed 1000 duplex full autoneg on']
    ],
    tip: 'Speed 显示 100Mb/s 但应该是千兆，先查线和水晶头（超五类线接法不对只能跑百兆）。'
  },
  {
    id: 'lnx-time',
    devs: ['Linux', '服务器'],
    name: '时间同步',
    kw: ['时间同步', 'ntp', 'chrony', 'timedatectl', '时间不对'],
    cmds: [
      ['通用', 'timedatectl\ntimedatectl set-timezone Asia/Shanghai'],
      ['CentOS 7+', 'chronyc sources -v\nchronyc makestep'],
      ['Ubuntu/Debian', 'timedatectl set-ntp true\nsystemctl restart systemd-timesyncd']
    ],
    tip: '集群里时间差超过 5 分钟，很多组件（Kerberos、证书、日志）会直接出问题。'
  },

  /* ---------------- Windows ---------------- */
  {
    id: 'win-ip',
    devs: ['Windows'],
    name: '查看 IP 配置',
    kw: ['查ip', 'ipconfig', '本机地址', '网关dns'],
    cmds: [
      ['CMD', 'ipconfig\nipconfig /all'],
      ['PowerShell', 'Get-NetIPAddress\nGet-NetIPConfiguration']
    ],
    tip: '看网关和 DNS 要用 ipconfig /all，光 ipconfig 只显示地址。'
  },
  {
    id: 'win-dhcp',
    devs: ['Windows'],
    name: '释放 / 重新获取 IP',
    kw: ['重新获取ip', 'ipconfig renew', 'dhcp刷新', '169.254'],
    cmds: [
      ['CMD', 'ipconfig /release\nipconfig /renew\nipconfig /flushdns'],
      ['PowerShell', 'ipconfig /release\nipconfig /renew']
    ],
    tip: '拿到 169.254.x.x 就是没拿到 DHCP，renew 一次；还不行就查网线和 DHCP 池。'
  },
  {
    id: 'win-route',
    devs: ['Windows'],
    name: 'Windows 查看与添加路由',
    kw: ['路由表', 'route print', '加路由', '双网卡'],
    cmds: [
      ['CMD', 'route print\nroute add 10.1.1.0 mask 255.255.255.0 192.168.1.1\nroute add 10.1.1.0 mask 255.255.255.0 192.168.1.1 -p'],
      ['PowerShell', 'Get-NetRoute\nNew-NetRoute -DestinationPrefix 10.1.1.0/24 -NextHop 192.168.1.1']
    ],
    tip: '不加 -p 重启就没了；-p 写进注册表才是永久的。'
  },
  {
    id: 'win-arp',
    devs: ['Windows'],
    name: '查看 ARP 缓存',
    kw: ['arp', 'arp -a', 'mac地址', 'arp欺骗'],
    cmds: [
      ['CMD', 'arp -a\narp -d *'],
      ['PowerShell', 'Get-NetNeighbor -AddressFamily IPv4']
    ],
    tip: 'ARP 表里同一个 MAC 对应多个 IP，基本可以判定 ARP 欺骗。'
  },
  {
    id: 'win-dns',
    devs: ['Windows'],
    name: 'DNS 查询与缓存',
    kw: ['dns查询', 'nslookup', '解析', '清dns缓存'],
    cmds: [
      ['CMD', 'nslookup www.example.com\nnslookup www.example.com 114.114.114.114\nipconfig /flushdns'],
      ['PowerShell', 'Resolve-DnsName www.example.com\nClear-DnsClientCache']
    ],
    tip: '指定 DNS 服务器查（nslookup 域名 服务器IP）能快速判断是本地 DNS 的问题还是域名本身的问题。'
  },
  {
    id: 'win-port',
    devs: ['Windows'],
    name: '查看端口占用',
    kw: ['端口占用', 'netstat', '谁占端口', 'pid'],
    cmds: [
      ['CMD', 'netstat -ano | findstr :8080\ntasklist | findstr 1234'],
      ['PowerShell', 'Get-NetTCPConnection -LocalPort 8080\nGet-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess']
    ],
    tip: 'netstat -ano 最后一列就是 PID，拿 PID 去 tasklist 查进程名，两条命令配合用。'
  },
  {
    id: 'win-firewall',
    devs: ['Windows'],
    name: 'Windows 防火墙放行端口',
    kw: ['防火墙', '放行端口', 'netsh', '入站规则'],
    cmds: [
      ['CMD', 'netsh advfirewall firewall add rule name="放行8080" dir=in action=allow protocol=TCP localport=8080'],
      ['PowerShell', 'New-NetFirewallRule -DisplayName "放行8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow'],
      ['查看规则', 'netsh advfirewall firewall show rule name=all']
    ],
    tip: 'Windows 防火墙默认拦入站，本地能访问、别人访问不了，先查这里。'
  },
  {
    id: 'win-tracert',
    devs: ['Windows'],
    name: '追踪路由与测端口',
    kw: ['tracert', '追踪路由', '测试端口', 'Test-NetConnection'],
    cmds: [
      ['CMD', 'tracert -d www.example.com\ntelnet 192.168.1.10 8080'],
      ['PowerShell', 'Test-NetConnection 192.168.1.10 -Port 8080\nTest-NetConnection www.example.com -TraceRoute']
    ],
    tip: 'Test-NetConnection 一条命令同时测 ICMP 和 TCP 端口，比 telnet 好用（telnet 客户端默认还没装）。'
  },
  {
    id: 'win-process',
    devs: ['Windows'],
    name: '查看进程',
    kw: ['进程', 'tasklist', '杀进程', 'cpu占用高'],
    cmds: [
      ['CMD', 'tasklist\ntasklist | findstr chrome\ntaskkill /PID 1234 /F'],
      ['PowerShell', 'Get-Process | Sort-Object CPU -Descending | Select-Object -First 10\nStop-Process -Id 1234 -Force']
    ],
    tip: 'tasklist 看全量，加 /FI 过滤更准；换成 Get-Process 能直接看内存和 CPU 占用。'
  },
  {
    id: 'win-rdp',
    devs: ['Windows'],
    name: '远程桌面连接',
    kw: ['远程桌面', 'mstsc', 'rdp', '3389'],
    cmds: [
      ['CMD', 'mstsc\nmstsc /v:192.168.1.10:3389'],
      ['开启远程', 'SystemPropertiesRemote.exe\n# 或用 PowerShell 开启\nSet-ItemProperty "HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server" -Name fDenyTSConnections -Value 0']
    ],
    tip: '连不上先确认 3389 通不通、对方是不是 Windows 家庭版（家庭版不支持被远程）。'
  },
  {
    id: 'win-share',
    devs: ['Windows'],
    name: '查看与映射共享',
    kw: ['共享', 'net share', '映射网络驱动器', '共享文件夹'],
    cmds: [
      ['CMD', 'net share\nnet use \\\\192.168.1.10\\share /user:admin <密码>\nnet use'],
      ['PowerShell', 'Get-SmbShare\nNew-SmbMapping -LocalPath Z: -RemotePath \\\\192.168.1.10\\share']
    ],
    tip: '访问共享提示无权限，多半是账号是本机账号、要写成 机器名\\用户名 或 域\\用户名。'
  },
  {
    id: 'win-static-ip',
    devs: ['Windows'],
    name: '设置静态 IP',
    kw: ['静态ip', '改ip', 'netsh interface', '固定地址'],
    cmds: [
      ['CMD', 'netsh interface ip set address "以太网" static 192.168.1.10 255.255.255.0 192.168.1.1'],
      ['恢复 DHCP', 'netsh interface ip set address "以太网" dhcp'],
      ['PowerShell', 'New-NetIPAddress -InterfaceAlias "以太网" -IPAddress 192.168.1.10 -PrefixLength 24 -DefaultGateway 192.168.1.1']
    ],
    tip: '接口名要写对（中文系统是「以太网」，英文是 Ethernet），写错会提示找不到接口。'
  },

  /* ---------------- 服务器 ---------------- */
  {
    id: 'srv-bmc',
    devs: ['服务器'],
    name: '带外管理（BMC / iDRAC / iLO）',
    kw: ['带外', 'bmc', 'idrac', 'ilo', 'ipmi', '远程开机'],
    cmds: [
      ['通用', 'ipmitool lan print\nipmitool power status\nipmitool power reset'],
      ['查看 SEL 日志', 'ipmitool sel list'],
      ['设置 BMC 地址', 'ipmitool lan set 1 ipsrc static\nipmitool lan set 1 ipaddr 192.168.1.100']
    ],
    tip: '操作系统失联时，带外管理是最后一根救命稻草，上线前一定确认 BMC 地址和账号可用。'
  },
  {
    id: 'srv-raid',
    devs: ['服务器'],
    name: '查看 RAID 与硬盘状态',
    kw: ['raid', '硬盘', '磁盘阵列', '硬盘故障灯'],
    cmds: [
      ['通用', 'cat /proc/mdstat\nlsscsi'],
      ['LSI / MegaRAID', 'storcli /c0 show\nstorcli /c0 /vall show'],
      ['HP / HPE', 'ssacli ctrl all show config']
    ],
    tip: '硬盘亮黄灯不一定坏了，先在 RAID 管理工具里看是不是 rebuild 中或 foreign 状态。'
  },
  {
    id: 'srv-disk',
    devs: ['服务器', 'Linux'],
    name: '查看磁盘空间',
    kw: ['磁盘空间', 'df', 'du', '满盘', '空间不足', '磁盘满了', '磁盘满', '盘满了', '清理磁盘'],
    cmds: [
      ['通用', 'df -h\ndu -sh /var/* | sort -rh | head -10'],
      ['找大文件', 'find / -type f -size +1G -exec ls -lh {} \\;'],
      ['inode 用尽', 'df -i']
    ],
    tip: 'df 显示没满但写不进去，八成是 inode 用完了（大量小文件），用 df -i 看。'
  },

  /* ---------------- 其他设备 ---------------- */
  {
    id: 'other-onu',
    devs: ['其他设备'],
    name: '光猫 / ONU 查看光功率',
    kw: ['光猫', 'onu', '光衰', '光功率', '宽带掉线'],
    cmds: [
      ['通用', '登录光猫管理页（常见 192.168.1.1 / 192.168.100.1）\n看「光功率」「接收光功率」一项'],
      ['正常范围', '接收光功率 建议 -8 ~ -25 dBm\n低于 -27 dBm 基本会掉线'],
      ['电信/联通/移动', '超管账号各省不同，普通账号一般看不到光功率']
    ],
    tip: '宽带频繁掉线先看接收光功率，再看 PON 口状态；光衰大就报修换尾纤。'
  },
  {
    id: 'other-ipphone',
    devs: ['其他设备'],
    name: 'IP 电话注册状态',
    kw: ['ip电话', '话机', 'sip', '注册失败', '分机'],
    cmds: [
      ['通用', '话机按菜单键 → 状态 → 网络 / SIP <账号>\n看是否 Registered'],
      ['常见话机品牌', 'Yealink：状态 → 账号状态\nCisco：Settings → Status → Phone'],
      ['排查', '确认能拿到 IP、能 ping 通 SIP 服务器、端口 5060 未被拦']
    ],
    tip: '话机显示注册失败，先确认它和语音服务器在同一网段或路由可达，再看 VLAN / 语音 VLAN 配没配。'
  },
  {
    id: 'other-camera',
    devs: ['其他设备'],
    name: '摄像头 / NVR 找不到设备',
    kw: ['摄像头', 'nvr', '监控', '摄像机', '搜不到设备', '摄像头不显示', '摄像头黑屏', '监控看不到画面', '监控黑屏'],
    cmds: [
      ['通用', '用厂商搜索工具（海康 SADP / 大华 ConfigTool）扫描同网段'],
      ['常见默认地址', '海康 192.168.1.64\n大华 192.168.1.108'],
      ['排查', '摄像头与 NVR 是否同网段 / PoE 口是否供电 / 密码是否被改过']
    ],
    tip: '新摄像头默认地址往往和现场网段不同，先用厂商工具扫出来再改地址。'
  },
  {
    id: 'other-printer',
    devs: ['其他设备'],
    name: '打印机 IP 与连接排查',
    kw: ['打印机', '打印不了', '打印机ip', '网络打印'],
    cmds: [
      ['通用', '打印机面板 → 网络设置 → 打印配置页，上面有 IP'],
      ['连通性', 'ping 打印机IP\ntelnet 打印机IP 9100'],
      ['Windows 添加', '控制面板 → 设备和打印机 → 添加打印机 → 按 IP 添加'],
      ['常见端口', 'RAW 9100 / LPR 515 / IPP 631']
    ],
    tip: '能 ping 通但打不出来，多半是驱动或端口选错（选成了 WSD 而不是 Standard TCP/IP）。'
  },

  /* ---------------- Linux 基础（日常操作） ---------------- */
  {
    id: 'lnx-fs',
    devs: ['Linux', '服务器'],
    name: '文件与目录操作',
    kw: ['文件操作', 'ls', 'cd', 'cp', 'mv', 'rm', '建目录', '复制文件', '基础命令'],
    cmds: [
      ['通用', 'ls -lh              # 看目录，带大小和权限\ncd /etc             # 进目录\ncd ..               # 回上级\npwd                 # 当前路径\ncp -r src dst       # 复制（目录加 -r）\nmv old new          # 移动 / 改名\nrm -rf 目录          # 删（-rf 慎用，删了没回收站）\nmkdir -p a/b/c      # 建多级目录'],
      ['权限相关', 'ls -l   # 第一位是类型，后面 9 位是 rwx 权限\nchmod 755 file\nchown user:group file']
    ],
    tip: 'rm -rf 没有回收站，路径写错一个空格就是灾难。养成先 ls 确认再删的习惯。'
  },
  {
    id: 'lnx-view',
    devs: ['Linux', '服务器'],
    name: '查看文件内容',
    kw: ['cat', 'less', 'tail', 'head', '看文件', '实时日志'],
    cmds: [
      ['通用', 'cat /etc/hosts        # 全量输出，小文件用\nless /etc/nginx.conf  # 大文件翻页，q 退出\ntail -f app.log       # 实时跟日志，Ctrl+C 退出\ntail -n 100 app.log   # 最后 100 行\nhead -n 20 app.log    # 前 20 行'],
      ['大文件技巧', 'less +G 文件     # 直接跳到末尾\nshift+g / gg     # less 里跳末尾 / 开头']
    ],
    tip: '看日志别用 cat，几万行刷屏后滚不回去；用 `less` 或 `tail -f`。'
  },
  {
    id: 'lnx-find',
    devs: ['Linux', '服务器'],
    name: '查找文件',
    kw: ['find', '找文件', 'which', 'locate', '文件在哪'],
    cmds: [
      ['通用', 'find / -name "*.conf"        # 按名字找\nfind /var -size +100M        # 找大于 100M 的\nfind / -mtime -7             # 7 天内改过的\nwhich nginx                  # 命令装在哪\nwhereis nginx'],
      ['按内容找', 'grep -rn "关键字" /etc/']
    ],
    tip: '`find /` 全盘找很慢，能确定目录就缩小范围；`which` 是查命令路径最快的办法。'
  },
  {
    id: 'lnx-grep',
    devs: ['Linux', '服务器'],
    name: '文本搜索 grep',
    kw: ['grep', '搜索文本', '过滤日志', '关键字', '管道过滤'],
    cmds: [
      ['通用', 'grep "error" app.log\ngrep -i "error" app.log      # 忽略大小写\ngrep -n "error" app.log      # 带行号\ngrep -v "debug" app.log      # 反向：排除\nps -ef | grep nginx          # 配合管道'],
      ['高级', 'grep -A 5 -B 5 "error" app.log   # 前后各 5 行\ngrep -c "error" app.log           # 统计条数']
    ],
    tip: '`-A/-B` 是排障神器：报错了把上下文抓出来，比只看到一行错误有用得多。'
  },
  {
    id: 'lnx-perm',
    devs: ['Linux', '服务器'],
    name: '权限与属主',
    kw: ['权限', 'chmod', 'chown', '755', '644', 'Permission denied'],
    cmds: [
      ['通用', 'chmod 755 script.sh      # rwxr-xr-x\nchmod 644 file.conf      # rw-r--r--\nchmod +x script.sh       # 加执行权限\nchown -R www:www /data   # 递归改属主\nls -l 看当前权限'],
      ['含义', 'r=4 w=2 x=1\n755 = 属主 rwx、属组 r-x、其他 r-x\n644 = 属主 rw-、属组 r--、其他 r--']
    ],
    tip: 'Permission denied 先看是「没有 x 权限」还是「属主不对」，两个方向完全不同。别一上来就 chmod 777。'
  },
  {
    id: 'lnx-user',
    devs: ['Linux', '服务器'],
    name: '用户与密码管理',
    kw: ['用户', 'useradd', 'passwd', 'sudo', '加用户', '改密码', '设置密码'],
    cmds: [
      ['通用', 'useradd -m -s /bin/bash tom   # 建用户并给 home\npasswd tom                    # 设密码\nusermod -aG wheel tom         # 加进 sudo 组（CentOS）\nid tom                        # 看用户属组\ndeluser -r tom                # 删用户和 home'],
      ['Ubuntu/Debian', 'usermod -aG sudo tom\nadduser tom                   # 交互式建用户，更省事']
    ],
    tip: 'CentOS 的 sudo 组叫 wheel，Ubuntu 叫 sudo，加错组等于没加。'
  },
  {
    id: 'lnx-tar',
    devs: ['Linux', '服务器'],
    name: '压缩与解压',
    kw: ['tar', '压缩', '解压', 'zip', 'gz', '打包'],
    cmds: [
      ['通用', 'tar -czvf bak.tar.gz /data     # 打包压缩\ntar -xzvf bak.tar.gz           # 解压\ntar -tzf bak.tar.gz            # 只看内容不解\ntar -xzvf bak.tar.gz -C /opt   # 解到指定目录'],
      ['zip', 'zip -r bak.zip /data\nunzip bak.zip -d /opt']
    ],
    tip: '参数顺序记法：c 创建 / x 解开 / t 查看 / z 走 gzip / v 显示过程 / f 指定文件名。f 一定放最后。'
  },
  {
    id: 'lnx-pkg',
    devs: ['Linux', '服务器'],
    name: '软件包安装',
    kw: ['安装软件', 'yum', 'apt', 'dnf', '装包', '包管理'],
    cmds: [
      ['CentOS/RHEL', 'yum install -y nginx\nyum remove nginx\nyum list installed | grep nginx\n# CentOS 8+ 用 dnf\n dnf install -y nginx'],
      ['Ubuntu/Debian', 'apt update\napt install -y nginx\napt remove nginx\ndpkg -l | grep nginx'],
      ['离线安装', 'rpm -ivh xxx.rpm        # CentOS\ndpkg -i xxx.deb         # Ubuntu']
    ],
    tip: 'Ubuntu 装包前必须先 `apt update` 刷索引，否则会提示找不到包——这是新手最常踩的坑。'
  },
  {
    id: 'lnx-ssh',
    devs: ['Linux', '服务器'],
    name: 'SSH 登录与传文件',
    kw: ['ssh', 'scp', '传文件', '远程登录', '免密登录'],
    cmds: [
      ['通用', 'ssh user@192.168.1.10\nssh -p 2222 user@192.168.1.10    # 指定端口\nscp file.txt user@192.168.1.10:/tmp/\nscp -r /data user@192.168.1.10:/bak/\nscp user@1.1.1.1:/tmp/a.log .   # 从远端拉回来'],
      ['免密登录', 'ssh-keygen -t rsa\nssh-copy-id user@192.168.1.10'],
      ['更快的传文件', 'rsync -avz /data/ user@192.168.1.10:/bak/']
    ],
    tip: 'scp 大目录很慢，用 rsync 能断点续传、只传差异。传完记得核对大小。'
  },
  {
    id: 'lnx-cron',
    devs: ['Linux', '服务器'],
    name: '定时任务 crontab',
    kw: ['定时任务', 'crontab', '计划任务', '每天执行', '凌晨跑脚本'],
    cmds: [
      ['通用', 'crontab -e        # 编辑当前用户的定时任务\ncrontab -l        # 查看\ncrontab -r        # 删除全部（慎用）'],
      ['时间格式', '分 时 日 月 周 命令\n0 3 * * * /opt/bak.sh        # 每天 3:00\n*/5 * * * * /opt/check.sh    # 每 5 分钟\n0 2 * * 1 /opt/week.sh       # 每周一 2:00'],
      ['系统级', 'vi /etc/crontab\nls /etc/cron.d/']
    ],
    tip: 'crontab 里命令要用绝对路径，环境变量和登录 shell 不一样，写 `python a.py` 很可能找不到 python。'
  },
  {
    id: 'lnx-sysinfo',
    devs: ['Linux', '服务器'],
    name: '查看系统与内核信息',
    kw: ['系统版本', 'uname', '内核', '发行版', 'os版本'],
    cmds: [
      ['通用', 'uname -a              # 内核版本\ncat /etc/os-release   # 发行版信息\nhostnamectl           # 主机名 + 系统 + 内核\nuptime                # 运行多久、负载'],
      ['CentOS/RHEL', 'cat /etc/redhat-release'],
      ['Ubuntu/Debian', 'lsb_release -a']
    ],
    tip: '装软件、查兼容性前先确认发行版和版本号，CentOS 7 和 9 的命令差得挺多。'
  },
  {
    id: 'lnx-disk',
    devs: ['Linux', '服务器'],
    name: '磁盘分区与挂载',
    kw: ['挂载', 'mount', 'lsblk', '分区', '加硬盘', 'fstab'],
    cmds: [
      ['通用', 'lsblk                  # 看块设备和分区\nfdisk -l               # 看所有磁盘\nmkfs.xfs /dev/sdb1     # 格式化\nmount /dev/sdb1 /data  # 挂载\nvi /etc/fstab          # 写进 fstab 才能开机自动挂'],
      ['fstab 示例', '/dev/sdb1  /data  xfs  defaults  0 0'],
      ['卸载', 'umount /data']
    ],
    tip: 'fstab 写错会导致开机进不去系统。改完先 `mount -a` 验证，没有报错再重启。'
  },
  {
    id: 'lnx-env',
    devs: ['Linux', '服务器'],
    name: '环境变量与 PATH',
    kw: ['环境变量', 'path', 'export', '命令找不到', 'command not found'],
    cmds: [
      ['临时', 'export PATH=$PATH:/opt/bin\necho $PATH'],
      ['永久（当前用户）', 'vi ~/.bashrc\n export PATH=$PATH:/opt/bin\nsource ~/.bashrc'],
      ['永久（全局）', 'vi /etc/profile\n# 或 /etc/profile.d/xxx.sh']
    ],
    tip: 'command not found 八成是 PATH 没配，或者装了但没 source。`which 命令` 能立刻确认。'
  },

  /* ---------------- Windows 补充 ---------------- */
  {
    id: 'win-ping',
    devs: ['Windows'],
    name: 'ping 高级参数',
    kw: ['ping参数', 'ping -t', 'ping大包', 'ping不通', '持续ping'],
    cmds: [
      ['CMD', 'ping -t 192.168.1.1           # 一直 ping，Ctrl+C 停\nping -n 10 192.168.1.1        # ping 10 次\nping -l 1472 192.168.1.1      # 指定包大小（测 MTU）\nping -a 192.168.1.1           # 反查主机名'],
      ['PowerShell', 'Test-Connection 192.168.1.1 -Count 10\nTest-Connection 192.168.1.1 -TcpPort 8080']
    ],
    tip: '测 MTU 用 `-l 1472` 且加 `-f`（不分片）：1472 通、1473 不通，说明 MTU 是 1500。'
  },
  {
    id: 'win-telnet',
    devs: ['Windows'],
    name: '启用 telnet 客户端',
    kw: ['telnet', '装telnet', 'telnet命令不存在'],
    cmds: [
      ['CMD', 'dism /online /Enable-Feature /FeatureName:TelnetClient\n# 或\npkgmgr /iu:"TelnetClient"'],
      ['替代方案', 'Test-NetConnection 192.168.1.10 -Port 8080\n# 更好用，不用装任何东西'],
      ['图形界面', '控制面板 → 程序 → 启用或关闭 Windows 功能 → 勾选 Telnet 客户端']
    ],
    tip: 'Windows 10/11 默认不装 telnet，直接敲会提示不是内部命令。用 Test-NetConnection 更省事。'
  },
  {
    id: 'win-sysinfo',
    devs: ['Windows'],
    name: '查看系统信息',
    kw: ['系统信息', 'systeminfo', 'windows版本', '补丁', '机器配置'],
    cmds: [
      ['CMD', 'systeminfo\nsysteminfo | findstr /C:"OS 名称" /C:"系统类型"\nwmic os get caption,version'],
      ['PowerShell', 'Get-ComputerInfo\nGet-CimInstance Win32_OperatingSystem | Select Caption,Version,LastBootUpTime']
    ],
    tip: 'systeminfo 会列出所有已打补丁，排查漏洞、确认版本很方便，但输出很慢，加 findstr 过滤快一些。'
  },
  {
    id: 'win-env',
    devs: ['Windows'],
    name: '环境变量',
    kw: ['环境变量', 'setx', 'path', 'java home', '命令找不到'],
    cmds: [
      ['CMD', 'set                    # 列出所有变量\nset PATH               # 看某个变量\necho %PATH%\nsetx JAVA_HOME "C:\\\\Java"   # 永久设置（新窗口才生效）'],
      ['PowerShell', '$env:PATH\n[Environment]::SetEnvironmentVariable("JAVA_HOME","C:\\Java","Machine")'],
      ['图形界面', 'Win+R → sysdm.cpl → 高级 → 环境变量']
    ],
    tip: 'setx 设置完要重开命令行窗口才生效；set 只在当前窗口有效，关掉就没了。'
  },
  {
    id: 'win-schtask',
    devs: ['Windows'],
    name: '计划任务',
    kw: ['计划任务', '定时任务', 'schtasks', '定时执行', '开机自启', '每天跑一次'],
    cmds: [
      ['CMD', 'schtasks /query /fo LIST        # 列出所有任务\nschtasks /create /tn "每日备份" /tr "D:\\bak.bat" /sc daily /st 03:00\nschtasks /delete /tn "每日备份" /f\nschtasks /run /tn "每日备份"    # 立刻跑一次'],
      ['PowerShell', 'Get-ScheduledTask\nStart-ScheduledTask -TaskName "每日备份"']
    ],
    tip: '计划任务跑失败最常见的原因：任务是以 SYSTEM 身份跑的，拿不到映射的网络盘符和用户环境变量。'
  }
];

module.exports = { SYS_EXTRA };
