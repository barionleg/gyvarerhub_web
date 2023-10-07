let menu_f = false;
let pin_id = null;

// ============== SCREEN ==============
function show_screen(nscreen) {
  if (focused) hub.dev(focused).fsStop();
  spinArrows(false);
  screen = nscreen;
  show_keypad(false);

  ['conn_icons', 'test_cont', 'projects_cont', 'config', 'devices',
    'controls', 'info', 'icon_menu', 'icon_cfg', 'fsbr', 'ota', 'back', 'icon_refresh',
    'footer_cont', 'conn'].forEach(e => display(e, 'none'));

  display('main_cont', 'block');

  EL('title').innerHTML = app_title;
  EL('title_row').style.cursor = 'pointer';

  switch (screen) {
    case 'main':
      display('conn_icons', 'inline-block');
      display('devices', 'grid');
      display('icon_cfg', 'inline-block');
      display('icon_refresh', 'inline-block');
      display('footer_cont', 'block');
      EL('title_row').style.cursor = 'unset';
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

    case 'ui':
      display('controls', 'block');
      display('icon_menu', 'inline-block');
      display('back', 'inline-block');
      display('icon_refresh', 'inline-block');
      display('conn', 'inline-block');
      EL('title').innerHTML = hub.dev(focused).info.name;
      break;

    case 'config':
      display('conn_icons', 'inline-block');
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
      EL('title').innerHTML = hub.dev(focused).info.name + '/info';

      let dev = hub.dev(focused);
      EL('info_break_sw').checked = dev.info.break_widgets;
      EL('info_names_sw').checked = dev.info.show_names;
      EL('info_cli_sw').checked = EL('cli_cont').style.display == 'block';

      EL('info_id').innerHTML = focused;
      EL('info_set').innerHTML = dev.prefix + '/' + focused + '/set/*';
      EL('info_read').innerHTML = dev.prefix + '/' + focused + '/read/*';
      EL('info_get').innerHTML = dev.prefix + '/hub/' + focused + '/get/*';
      EL('info_status').innerHTML = dev.prefix + '/hub/' + focused + '/status';
      display('reboot_btn', dev.module(Modules.REBOOT) ? 'block' : 'none');

      EL('info_version').innerHTML = '';
      EL('info_net').innerHTML = '';
      EL('info_memory').innerHTML = '';
      EL('info_system').innerHTML = '';
      break;

    case 'fsbr':
      display('fsbr', 'block');
      display('icon_menu', 'inline-block');
      display('back', 'inline-block');
      display('conn', 'inline-block');
      display('icon_refresh', 'inline-block');
      EL('title').innerHTML = hub.dev(focused).info.name + '/fs';
      break;

    case 'ota':
      display('ota', 'block');
      display('icon_menu', 'inline-block');
      display('back', 'inline-block');
      display('conn', 'inline-block');
      EL('title').innerHTML = hub.dev(focused).info.name + '/ota';
      break;

    case 'pin':
      display('back', 'inline-block');
      show_keypad(true);
      break;
  }
}

// =========== HANDLERS ===========
function resize_h() {
  showGauges();
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
  if (focused) post(screen);
  else discover();
}
function back_h() {
  if (focused) hub.dev(focused).fsStop();
  if (EL('fsbr_edit').style.display == 'block') {
    editor_cancel();
    return;
  }
  if (menu_f) {
    menuDeact();
    menu_show(0);
    return;
  }
  switch (screen) {
    case 'ui':
      release_all();
      close_device();
      break;
    case 'info':
    case 'fsbr':
    case 'ota':
      menuDeact();
      showControls(hub.dev(focused).controls);
      show_screen('ui');
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
    show_screen('main');
    if (cfg_changed) {
      save_cfg();
      discover();
    }
    cfg_changed = false;
  } else {
    show_screen('config');
  }
}
function info_h() {
  menuDeact();
  menu_show(0);
  if (hub.dev(focused).module(Modules.INFO)) post('info');
  show_screen('info');
  EL('menu_info').classList.add('menu_act');
}
function fsbr_h() {
  menuDeact();
  menu_show(0);
  if (hub.dev(focused).module(Modules.FSBR)) {
    post('fsbr');
    EL('fsbr_inner').innerHTML = waiter();
  }
  display('fs_browser', hub.dev(focused).module(Modules.FSBR) ? 'block' : 'none');
  display('fs_upload', hub.dev(focused).module(Modules.UPLOAD) ? 'block' : 'none');
  display('fs_format', hub.dev(focused).module(Modules.FORMAT) ? 'inline-block' : 'none');
  show_screen('fsbr');
  EL('menu_fsbr').classList.add('menu_act');
}
function format_h() {
  if (confirm('Format filesystem?')) post('format');
}
function ota_h() {
  menuDeact();
  menu_show(0);
  show_screen('ota');
  EL('menu_ota').classList.add('menu_act');

  let ota_t = '.' + hub.dev(focused).info.ota_t;
  EL('ota_upload').accept = ota_t;
  EL('ota_upload_fs').accept = ota_t;
  EL('ota_url_f').value = "http://flash" + ota_t;
  EL('ota_url_fs').value = "http://filesystem" + ota_t;
  display('fs_otaf', hub.dev(focused).module(Modules.OTA) ? 'block' : 'none');
  display('fs_otaurl', hub.dev(focused).module(Modules.OTA_URL) ? 'block' : 'none');
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
function menu_h() {
  menu_show(!menu_f);
}

// ============== MENU =============
function menu_show(state) {
  menu_f = state;
  let cl = EL('menu').classList;
  if (menu_f) cl.add('menu_show');
  else cl.remove('menu_show');
  EL('icon_menu').innerHTML = menu_f ? '' : '';
  display('menu_overlay', menu_f ? 'block' : 'none');
}

// ============== DEVICE =============
function device_h(id) {
  let dev = hub.dev(id);
  if (!dev || dev.conn == Conn.NONE) return;
  if (dev.info.PIN && !dev.granted) {
    pin_id = id;
    show_screen('pin');
  } else {
    open_device(id);
  }
}
function open_device(id) {
  /*NON-ESP*/
  checkUpdates(id);
  /*/NON-ESP*/

  focused = id;
  EL('menu_user').innerHTML = '';
  EL('conn').innerHTML = Conn.names[hub.dev(id).conn];
  showControls(hub.dev(id).controls, true);
  show_screen('ui');
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
    hub.delete(id);
    EL(`device#${id}`).remove();
    return 1;
  }
  return 0;
}

// ============== CLI =============
function showCLI(v) {
  EL('bottom_space').style.height = v ? '170px' : '50px';
  display('cli_cont', v ? 'block' : 'none');
  if (v) EL('cli_input').focus();
  EL('info_cli_sw').checked = v;
}
function printCLI(text, color) {
  if (EL('cli_cont').style.display == 'block') {
    if (EL('cli').innerHTML) EL('cli').innerHTML += '\n';
    let st = color ? `style="color:${intToCol(color)}"` : '';
    EL('cli').innerHTML += `<span ${st}>${text}</span>`;
    EL('cli').scrollTop = EL('cli').scrollHeight;
  }
}
function toggleCLI() {
  EL('cli').innerHTML = "";
  EL('cli_input').value = "";
  showCLI(!(EL('cli_cont').style.display == 'block'));
}
function checkCLI(event) {
  if (event.key == 'Enter') sendCLI();
}
function sendCLI() {
  post('cli', 'cli', EL('cli_input').value);
  EL('cli').innerHTML += "\n >" + EL('cli_input').value;
  EL('cli').scrollTop = EL('cli').scrollHeight;
  EL('cli_input').value = "";
}

// =========== PIN ===========
function pass_type(v) {
  EL('pass_inp').value += v;
  let hash = EL('pass_inp').value.hashCode();

  if (pin_id) {   // device
    if (hash == hub.dev(pin_id).info.PIN) {
      open_device(pin_id);
      EL('pass_inp').value = '';
      hub.dev(pin_id).granted = true;
    }
  } else {        // app
    if (hash == cfg.pin) {
      display('password', 'none');
      startup();
      EL('pass_inp').value = '';
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