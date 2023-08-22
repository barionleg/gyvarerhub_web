const http_port = 80;
const ws_port = 81;

const oninput_prd = 100;
const ws_tout = 4000;

let set_tout = null;
let oninput_tout = null;
let refresh_ui = false;

let s_port = null, s_state = false, s_reader = null, s_buf = '';

const Conn = {
  SERIAL: 0,
  BT: 1,
  WS: 2,
  MQTT: 3,
  NONE: 4,
  ERROR: 5,
  names = ['Serial', 'BT', 'WS', 'MQTT', 'None', 'Error']
};

// ============== SEND ================
function click_h(name, dir) {
  pressId = (dir == 1) ? name : null;
  post('set', name, dir);
  reset_ping();
}
function set_h(name, value = '') {
  post('set', name, value);
  reset_ping();
}
function input_h(name, value) {
  if (!(name in oninp_buffer)) oninp_buffer[name] = { 'value': null, 'tout': null };

  if (!oninp_buffer[name].tout) {
    set_h(name, value);

    oninp_buffer[name].tout = setTimeout(() => {
      if (oninp_buffer[name].value != null && !tout_interval) set_h(name, oninp_buffer[name].value);
      oninp_buffer[name].tout = null;
      oninp_buffer[name].value = null;
    }, oninput_prd);
  } else {
    oninp_buffer[name].value = value;
  }
}
function reboot_h() {
  post('reboot');
}


// ============= WEBSOCKET ==============
function ws_start(id) {
  if (!hub.cfg.use_local) return;
  checkHTTP(id);
  if (devices_t[id].ws) return;
  if (devices[id].ip == 'unset') return;
  log(`WS ${id} open...`);

  devices_t[id].ws = new WebSocket(`ws://${devices[id].ip}:${ws_port}/`, ['hub']);

  devices_t[id].ws.onopen = function () {
    log(`WS ${id} opened`);
    if (id != focused) devices_t[id].ws.close();
  };

  devices_t[id].ws.onclose = function () {
    log(`WS ${id} closed`);
    devices_t[id].ws = null;
    if (id == focused) setTimeout(() => ws_start(id), 500);
  };

  devices_t[id].ws.onerror = function () {
    log(`WS ${id} error`);
  };

  devices_t[id].ws.onmessage = function (event) {
    reset_tout();
    parsePacket(id, event.data, Conn.WS);
  };
}
function ws_stop(id) {
  if (!devices_t[id].ws || devices_t[id].ws.readyState >= 2) return;
  log(`WS ${id} close...`);
  devices_t[id].ws.close();
}
function ws_state(id) {
  return (devices_t[id].ws && devices_t[id].ws.readyState == 1);
}
function ws_send(id, text) {
  if (ws_state(id)) devices_t[id].ws.send(text.toString() + '\0');   // no '\0'
}


function ws_discover() {
  for (let id in devices) {
    if (devices[id].ip == 'unset') continue;
    ws_discover_ip(devices[id].ip, id);
    log('WS discover');
  }
}
function ws_discover_ip(ip, id = 'unfocused') {
  let ws = new WebSocket(`ws://${ip}:${ws_port}/`, ['hub']);
  let tout = setTimeout(() => {
    if (ws) ws.close();
  }, ws_tout);
  ws.onopen = () => ws.send(hub.cfg.prefix + (id != 'unfocused' ? ('/' + id) : '') + '\0');
  ws.onerror = () => ws.close();
  ws.onclose = () => ws = null;
  ws.onmessage = function (event) {
    clearTimeout(tout);
    parseDevice(id, event.data, Conn.WS, ip);
    ws.close();
  };
}
function ws_discover_ips(ips) {
  spinArrows(true);
  setTimeout(() => {
    spinArrows(false);
  }, ws_tout / 200 * ips.length);

  for (let i in ips) {
    setTimeout(() => ws_discover_ip(ips[i]), ws_tout / 200 * i);
  }
  log('WS discover all');
}
function http_hook(ips) {
  spinArrows(true);
  setTimeout(() => {
    spinArrows(false);
  }, ws_tout);

  function hook(ip) {
    try {
      let xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
          if (this.responseText == 'OK') ws_discover_ip(ip);
        }
      }
      xhr.timeout = tout_prd;
      xhr.open("GET", 'http://' + ip + ':' + http_port + '/hub_discover_all');
      xhr.send();
    } catch (e) {
    }
  }

  for (let i in ips) {
    setTimeout(() => hook(ips[i]), 10 * i);
  }
  log('WS hook discover all');
}
function ws_discover_all() {
  let ip_arr = getIPs(EL('local_ip').value, hub.cfg.netmask);
  if (ip_arr == null) return;
  if (hub.cfg.use_hook) http_hook(ip_arr);
  else ws_discover_ips(ip_arr);
}
function add_ip_h(ip) {
  if (!checkIP(ip)) {
    showPopupError('Wrong IP!');
    return;
  }
  log('WS manual ' + ip);
  ws_discover_ip(ip);
  back_h();
}
function checkHTTP(id) {
  if (devices_t[id].http_cfg.upd) return;

  let xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function () {
    if (this.readyState == 4 && this.status == 200) {
      devices_t[id].http_cfg.upd = 1;
      let resp;
      try {
        resp = JSON.parse(this.responseText);
      } catch (e) {
        return;
      }
      for (let i in resp) {
        if (resp[i]) devices_t[id].http_cfg[i] = resp[i];
      }
    }
  }
  xhr.timeout = tout_prd;
  xhr.open("GET", 'http://' + devices[id].ip + ':' + http_port + '/hub_http_cfg');
  xhr.send();
}

/*NON-ESP*/
// ================ SERIAL ================
async function serial_select() {
  await serial_stop();
  const ports = await navigator.serial.getPorts();
  for (let port of ports) await port.forget();
  try {
    await navigator.serial.requestPort();
  } catch (e) {
  }
  serial_change();
}
async function serial_discover() {
  serial_send(hub.cfg.prefix);
}
async function serial_start() {
  try {
    s_state = true;
    const ports = await navigator.serial.getPorts();
    if (!ports.length) return;
    s_port = ports[0];
    await s_port.open({ baudRate: hub.cfg.baudrate });

    log('[Serial] Open');
    serial_show_icon(true);
    if (s_buf) {
      setTimeout(function () {
        serial_send(s_buf);
        s_buf = '';
      }, 2000);
    }

    while (s_port.readable) {
      s_reader = s_port.readable.getReader();
      let buffer = '';
      try {
        while (true && s_state) {
          const { value, done } = await s_reader.read();
          if (done) break;
          const data = new TextDecoder().decode(value);
          if (focused) {
            parsePacket(focused, data, Conn.SERIAL);
          } else {
            buffer += data;
            if (buffer.endsWith("}\n")) {
              parseDevice('unfocused', buffer, Conn.SERIAL);
              buffer = '';
            }
          }
        }
      } catch (error) {
        log("[Serial] " + error);
      } finally {
        await s_reader.releaseLock();
        await s_port.close();
        log('[Serial] Close');
        break;
      }
    }
  } catch (error) {
    log("[Serial] " + error);
  }
  s_reader = null;
  s_state = false;
  serial_show_icon(false);
}
async function serial_send(text) {
  if (!s_state) {
    serial_start();
    s_buf = text;
    return;
  }
  try {
    const encoder = new TextEncoder();
    const writer = s_port.writable.getWriter();
    await writer.write(encoder.encode(text + '\0'));
    writer.releaseLock();
  } catch (e) {
    log("[Serial] " + e);
  }
}
async function serial_stop() {
  if (s_reader) s_reader.cancel();
  s_state = false;
}
function serial_toggle() {
  if (s_state) serial_stop();
  else serial_start();
}
function serial_show_icon(state) {
  EL('serial_ok').style.display = state ? 'inline-block' : 'none';
}
async function serial_change() {
  serial_show_icon(0);
  if (s_state) await serial_stop();
  const ports = await navigator.serial.getPorts();
  EL('serial_btn').style.display = ports.length ? 'inline-block' : 'none';
}

/*/NON-ESP*/