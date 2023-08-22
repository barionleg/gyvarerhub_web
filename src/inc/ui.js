// =========== CONST ===========
const colors = {
  ORANGE: 0xd55f30,
  YELLOW: 0xd69d27,
  GREEN: 0x37A93C,
  MINT: 0x25b18f,
  AQUA: 0x2ba1cd,
  BLUE: 0x297bcd,
  VIOLET: 0x825ae7,
  PINK: 0xc8589a,
};
const fonts = [
  'monospace',
  'system-ui',
  'cursive',
  'Arial',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Georgia',
  'Garamond',
];
const themes = {
  DARK: 0,
  LIGHT: 1
};
const baudrates = [
  4800, 9600, 19200, 38400, 57600, 74880, 115200, 230400, 250000, 500000, 1000000, 2000000
];
const theme_cols = [
  // back/tab/font/font2/dark/thumb/black/scheme/font4/shad/font3
  ['#1b1c20', '#26272c', '#eee', '#ccc', '#141516', '#444', '#0e0e0e', 'dark', '#222', '#000'],
  ['#eee', '#fff', '#111', '#333', '#ddd', '#999', '#bdbdbd', 'light', '#fff', '#000000a3']
];

// =========== VARS ===========
let updates = [];
let cfg_changed = false;
let screen = 'main';
let deferredPrompt = null;
let pin_id = null;
let menu_f = false;
let push_timer = 0;

function post(cmd, name = '', value = '') {
  if (focused) hub.post(focused, cmd, name, value);
}

// =========== PIN ===========
function pass_type(v) {
  pass_inp.value += v;
  let hash = pass_inp.value.hashCode();

  if (pin_id) {   // device
    if (hash == hub.devinf(pin_id).PIN) {
      open_device(pin_id);
      pass_inp.value = '';
      hub.dev(pin_id).granted = true;
    }
  } else {        // app
    if (hash == cfg.pin) {
      EL('password').style.display = 'none';
      startup();
      pass_inp.value = '';
    }
  }
}
function check_type(arg) {
  if (arg.value.length > 0) {
    let c = arg.value[arg.value.length - 1];
    if (c < '0' || c > '9') arg.value = arg.value.slice(0, -1);
  }
}
function show_keypad(v) {
  if (v) {
    display('password', 'block');
    EL('pass_inp').focus();
  } else {
    display('password', 'none');
  }
}

// =========== HANDLERS ===========
function resize_h() {
  showGauges();
}

// ============== SCREEN ==============
function show_screen(nscreen) {
  //stopFS();
  spinArrows(false);
  screen = nscreen;
  show_keypad(false);

  ['conn_icons', 'test_cont', 'projects_cont', 'config', 'devices',
    'controls', 'info', 'icon_menu', 'icon_cfg', 'fsbr', 'back', 'icon_refresh',
    'version', 'footer_cont', 'conn'].forEach(e => display(e, 'none'));

  display('main_cont', 'block');

  EL('title').innerHTML = app_title;
  let title_row_s = EL('title_row').style;
  title_row_s.cursor = 'pointer';

  switch (screen) {
    case 'main':
      display('conn_icons', 'flex');
      display('version', 'unset');
      display('devices', 'grid');
      display('icon_cfg', 'inline-block');
      display('icon_refresh', 'inline-block');
      display('footer_cont', 'block');
      title_row_s.cursor = 'unset';
      showCLI(false);
      break;

    case 'test':
      display('main_cont', 'none');
      display('test_cont', 'block');
      display('back', 'inline-block');
      EL('title').innerHTML = 'UI Test';
      break;

    case 'projects':
      display('main_cont', 'none');
      display('projects_cont', 'block');
      display('back', 'inline-block');
      EL('title').innerHTML = 'Projects';
      break;

    case 'device':
      display('controls', 'block');
      display('icon_menu', 'inline-block');
      display('back', 'inline-block');
      display('icon_refresh', 'inline-block');
      display('conn', 'inline-block');
      EL('title').innerHTML = hub.devinf(focused).name;
      break;

    case 'config':
      display('conn_icons', 'flex');
      display('config', 'block');
      display('icon_cfg', 'inline-block');
      display('back', 'inline-block');
      EL('title').innerHTML = 'Config';
      break;

    case 'info':
      display('info', 'block');
      display('icon_menu', 'inline-block');
      display('back', 'inline-block');
      display('conn', 'inline-block');
      EL('title').innerHTML = hub.devinf(focused).name + '/info';
      update_info();
      break;

    case 'fsbr':
      display('fsbr', 'block');
      display('icon_menu', 'inline-block');
      display('back', 'inline-block');
      display('conn', 'inline-block');
      EL('title').innerHTML = hub.devinf(focused).name + '/fs';
      break;

    case 'pin':
      display('back', 'inline-block');
      show_keypad(true);
      break;
  }
}
function test_h() {
  show_screen('test');
}
function projects_h() {
  EL('projects').innerHTML = '';
  show_screen('projects');
  loadProjects();
}
function refresh_h() {
  if (screen == 'device') post('focus');
  else if (screen == 'info') post('info');
  else if (screen == 'fsbr') post('fsbr');
  else discover();
}
function back_h() {
  if (EL('fsbr_edit').style.display == 'block') {
    editor_cancel();
    return;
  }
  //stopFS();
  if (menu_f) {
    menuDeact();
    menu_show(0);
    return;
  }
  switch (screen) {
    case 'device':
      release_all();
      close_device();
      break;
    case 'info':
    case 'fsbr':
      menuDeact();
      showControls(hub.dev(focused).controls);
      show_screen('device');
      break;
    case 'config':
      config_h();
      break;
    case 'pin':
    case 'projects':
    case 'test':
      show_screen('main');
      break;
  }
}
function config_h() {
  if (screen == 'config') {
    if (cfg_changed) save_cfg();
    cfg_changed = false;
    show_screen('main');
    discover();
  } else {
    show_screen('config');
  }
}
function info_h() {
  stopFS();
  menuDeact();
  menu_show(0);
  if (readModule(Modules.INFO)) post('info');
  show_screen('info');
  EL('menu_info').classList.add('menu_act');
}
function fsbr_h() {
  menuDeact();
  menu_show(0);
  if (readModule(Modules.FSBR)) {
    post('fsbr');
    EL('fsbr_inner').innerHTML = waiter();
  }
  EL('fs_browser').style.display = readModule(Modules.FSBR) ? 'block' : 'none';
  EL('fs_upload').style.display = readModule(Modules.UPLOAD) ? 'block' : 'none';
  EL('fs_otaf').style.display = readModule(Modules.OTA) ? 'block' : 'none';
  EL('fs_otaurl').style.display = readModule(Modules.OTA_URL) ? 'block' : 'none';
  EL('fs_format').style.display = readModule(Modules.FORMAT) ? 'inline-block' : 'none';
  EL('fs_update').style.display = readModule(Modules.FSBR) ? 'inline-block' : 'none';
  show_screen('fsbr');
  EL('menu_fsbr').classList.add('menu_act');
}
function device_h(id) {
  if (hub.dev(id).conn == Conn.NONE) return;
  if (hub.devinf(id).PIN && !hub.dev(id).granted) {
    pin_id = id;
    show_screen('pin');
  } else open_device(id);
}
function open_device(id) {
  /*NON-ESP*/
  checkUpdates(id);
  /*/NON-ESP*/

  focused = id;
  // if (hub.dev(id).conn == Conn.HTTP) hub.ws.start(id);
  EL('menu_user').innerHTML = '';
  EL('conn').innerHTML = Conn.names[hub.dev(id).conn];
  showControls(hub.dev(id).controls, true);
  show_screen('device');
  hub.dev(id).focus();
}
function close_device() {
  errorBar(false);
  hub.dev(focused).unfocus();
  focused = null;
  show_screen('main');
}
function delete_h(id) {
  if (confirm('Delete ' + id + '?')) {
    document.getElementById("device#" + id).remove();
    delete devices[id];
    save_devices();
    return 1;
  }
  return 0;
}
function update_ip_h() {
  /*NON-ESP*/
  if (!Boolean(window.webkitRTCPeerConnection || window.mozRTCPeerConnection)) notSupported();
  else getLocalIP().then((ip) => {
    if (ip.indexOf("local") > 0) alert(`Disable WEB RTC anonymizer: ${browser()}://flags/#enable-webrtc-hide-local-ips-with-mdns`);
    else EL('local_ip').value = ip;
  });
  /*/NON-ESP*/
  if (isESP()) EL('local_ip').value = window_ip();
}
function menu_show(state) {
  menu_f = state;
  let cl = EL('menu').classList;
  if (menu_f) cl.add('menu_show');
  else cl.remove('menu_show');
  EL('icon_menu').innerHTML = menu_f ? '' : '';
  EL('menu_overlay').style.display = menu_f ? 'block' : 'none';
}
function menu_h() {
  menu_show(!menu_f);
}
function update_info() {
  let id = focused;
  EL('info_break_sw').checked = devices[id].break_widgets;
  EL('info_names_sw').checked = devices[id].show_names;
  EL('info_cli_sw').checked = EL('cli_cont').style.display == 'block';

  EL('info_id').innerHTML = id;
  EL('info_set').innerHTML = devices[id].prefix + '/' + id + '/set/*';
  EL('info_read').innerHTML = devices[id].prefix + '/' + id + '/read/*';
  EL('info_get').innerHTML = devices[id].prefix + '/hub/' + id + '/get/*';
  EL('info_status').innerHTML = devices[id].prefix + '/hub/' + id + '/status';
  EL('reboot_btn').style.display = readModule(Modules.REBOOT) ? 'block' : 'none';

  EL('info_version').innerHTML = '';
  EL('info_net').innerHTML = '';
  EL('info_memory').innerHTML = '';
  EL('info_system').innerHTML = '';
}

// ============== CLI =============
function showCLI(v) {
  EL('bottom_space').style.height = v ? '170px' : '50px';
  EL('cli_cont').style.display = v ? 'block' : 'none';
  if (v) EL('cli_input').focus();
  EL('info_cli_sw').checked = v;
}
function printCLI(text, color) {
  if (EL('cli_cont').style.display == 'block') {
    if (EL('cli').innerHTML) EL('cli').innerHTML += '\n';
    let st = color ? `style="color:${intToCol(color)}"` : '';
    EL('cli').innerHTML += `><span ${st}">${text}</span>`;
    EL('cli').scrollTop = EL('cli').scrollHeight;
  }
}
function toggleCLI() {
  EL('cli').innerHTML = "";
  EL('cli_input').value = "";
  showCLI(!(EL('cli_cont').style.display == 'block'));
}
function checkCLI() {
  if (event.key == 'Enter') sendCLI();
}
function sendCLI() {
  post('cli', 'cli', EL('cli_input').value);
  EL('cli_input').value = "";
}

// ============== PROJECTS =============
/*NON-ESP*/
async function checkUpdates(id) {
  if (!cfg.check_upd) return;
  if (updates.includes(id)) return;
  let ver = hub.devinf(id).version;
  if (!ver.includes('@')) return;
  let namever = ver.split('@');
  const resp = await fetch(`https://raw.githubusercontent.com/${namever[0]}/master/project.json`, { cache: "no-store" });
  let proj = await resp.text();
  try {
    proj = JSON.parse(proj);
  } catch (e) {
    return;
  }
  if (proj.version == namever[1]) return;
  if (id != focused) return;
  updates.push(id);
  if (confirm('Available new version v' + proj.version + ' for device [' + namever[0] + ']. Notes:\n' + proj.notes + '\n\nUpdate firmware?')) {
    if ('ota_url' in proj) otaUrl(proj.ota_url, 'flash');
    else otaUrl(`https://raw.githubusercontent.com/${namever[0]}/master/bin/firmware.bin${devices[id].ota_t == 'bin' ? '' : ('.' + devices[id].ota_t)}`, 'flash');
  }
}
async function pwa_install(ssl) {
  if (ssl && !isSSL()) {
    if (confirm("Redirect to HTTPS?")) window.location.href = window.location.href.replace('http:', 'https:');
    else return;
  }
  if (!ssl && isSSL()) {
    if (confirm("Redirect to HTTP")) window.location.href = window.location.href.replace('https:', 'http:');
    else return;
  }
  if (!('serviceWorker' in navigator)) {
    alert('Error');
    return;
  }
  if (deferredPrompt !== null) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') deferredPrompt = null;
  }
}
async function loadProjects() {
  const resp = await fetch("https://raw.githubusercontent.com/GyverLibs/GyverHub-projects/main/projects.txt", { cache: "no-store" });
  let projects = await resp.text();
  projects = projects.split('\n');
  for (let proj of projects) {
    if (!proj) continue;
    let rep = proj.split('https://github.com/')[1];
    if (!rep) continue;
    loadProj(rep);
  }
}
async function loadProj(rep) {
  try {
    const resp = await fetch(`https://raw.githubusercontent.com/${rep}/master/project.json`, { cache: "no-store" });
    let proj = await resp.json();
    if (!('version' in proj) || !('notes' in proj) || !('about' in proj)) return;
    let name = rep.split('/')[1];
    if (name.length > 30) name = name.slice(0, 30) + '..';
    EL('projects').innerHTML += `
    <div class="proj">
      <div class="proj_inn">
        <div class="proj_name">
          <a href="${'https://github.com/' + rep}" target="_blank" title="${rep} v${proj.version}">${name}</a>
          <!--<a href="javascript:void(0)" onclick="">[bin]</a>-->
        </div>
        <div class="proj_about">${proj.about}</div>
      </div>
    </div>
    `;
  } catch (e) {
    return;
  }
}
async function copyBin() {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) { }
}
/*/NON-ESP*/

// ============ INFO ============
let popupT1 = null, popupT2 = null;
function showPopup(text, color = '#37a93c') {
  if (popupT1) clearTimeout(popupT1);
  if (popupT2) clearTimeout(popupT2);
  EL('notice').innerHTML = text;
  EL('notice').style.background = color;
  EL('notice').style.display = 'block';
  EL('notice').style.animation = "fade-in 0.5s forwards";
  popupT1 = setTimeout(() => { popupT1 = null; EL('notice').style.display = 'none' }, 3500);
  popupT2 = setTimeout(() => { popupT2 = null; EL('notice').style.animation = "fade-out 0.5s forwards" }, 3000);
}
function showPopupError(text) {
  showPopup(text, '#a93737');
}
function errorBar(v) {
  EL('head_cont').style.background = v ? 'var(--err)' : 'var(--prim)';
}
function spinArrows(val) {
  if (val) EL('icon_refresh').classList.add('spinning');
  else EL('icon_refresh').classList.remove('spinning');
}

// ============ UI ============
function waiter(size = 50, col = 'var(--prim)', block = true) {
  return `<div class="waiter ${block ? 'waiter_b' : ''}"><span style="font-size:${size}px;color:${col}" class="icon spinning"></span></div>`;
}
function bt_show_ok(state) {
  EL('bt_ok').style.display = state ? 'inline-block' : 'none';
}