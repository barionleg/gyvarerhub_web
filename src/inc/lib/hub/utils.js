// const
const Conn = {
  SERIAL: 0,
  BT: 1,
  HTTP: 2,
  MQTT: 3,
  NONE: 4,
  names: [
    'Serial', 'BT', 'HTTP', 'MQTT', 'None'
  ],
};
const Modules = {
  INFO: (1 << 0),
  FSBR: (1 << 1),
  FORMAT: (1 << 2),
  DOWNLOAD: (1 << 3),
  UPLOAD: (1 << 4),
  OTA: (1 << 5),
  OTA_URL: (1 << 6),
  REBOOT: (1 << 7),
  SET: (1 << 8),
  READ: (1 << 9),
  DELETE: (1 << 10),
  RENAME: (1 << 11)
};

// ip
function checkIP(ip) {
  return Boolean(ip.match(/^((25[0-5]|(2[0-4]|1[0-9]|[1-9]|)[0-9])(\.(?!$)|$)){4}$/));
}
function getIPs(ip, netmask) {
  if (!checkIP(ip)) {
    alert('Wrong local IP!');
    return null;
  }
  let ip_a = ip.split('.');
  let sum_ip = (ip_a[0] << 24) | (ip_a[1] << 16) | (ip_a[2] << 8) | ip_a[3];
  let cidr = Number(netmask);
  let mask = ~(0xffffffff >>> cidr);
  let network = 0, broadcast = 0, start_ip = 0, end_ip = 0;
  if (cidr === 32) {
    network = sum_ip;
    broadcast = network;
    start_ip = network;
    end_ip = network;
  } else {
    network = sum_ip & mask;
    broadcast = network + (~mask);
    if (cidr === 31) {
      start_ip = network;
      end_ip = broadcast;
    } else {
      start_ip = network + 1;
      end_ip = broadcast - 1;
    }
  }
  let ips = ['192.168.4.1'];  // for esp
  for (let ip = start_ip; ip <= end_ip; ip++) {
    ips.push(`${(ip >>> 24) & 0xff}.${(ip >>> 16) & 0xff}.${(ip >>> 8) & 0xff}.${ip & 0xff}`);
  }
  return ips;
}
/*async function fetchT(url, options = {}, tout = 5000) {
  const controller = new AbortController();
  const t_id = setTimeout(() => controller.abort(), tout);
  const response = await fetch(url, { ...options, signal: controller.signal });
  clearTimeout(t_id);
  return response;
}*/

// log
function log(text) {
  console.log('Log: ' + text);
}
function err(text) {
  console.log('Error: ' + text);
}