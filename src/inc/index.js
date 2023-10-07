window.onload = () => {
  render_main();
  EL('hub_stat').innerHTML = 'GyverHub v' + app_version + ' ' + (isPWA() ? 'PWA ' : '') + (isSSL() ? 'SSL ' : '') + (isLocal() ? 'Local ' : '') + (isESP() ? 'ESP ' : '') + (isApp() ? 'App ' : '');

  load_cfg();
  load_cfg_hub();
  if (isESP()) hub.cfg.use_local = true;  // force local on esp
  update_ip();
  update_theme();
  set_drop();
  key_change();
  handle_back();
  register_SW();
  if (cfg.use_pin) show_keypad(true);
  else startup();

  function register_SW() {
    /*NON-ESP*/
    if ('serviceWorker' in navigator && !isLocal() && !isApp()) {
      navigator.serviceWorker.register('sw.js');
      window.addEventListener('beforeinstallprompt', (e) => deferredPrompt = e);
    }
    /*/NON-ESP*/
  }
  function set_drop() {
    function preventDrop(e) {
      e.preventDefault()
      e.stopPropagation()
    }
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => {
      document.body.addEventListener(e, preventDrop, false);
    });

    ['dragenter', 'dragover'].forEach(e => {
      document.body.addEventListener(e, function () {
        document.querySelectorAll('.drop_area').forEach((el) => {
          el.classList.add('active');
        });
      }, false);
    });

    ['dragleave', 'drop'].forEach(e => {
      document.body.addEventListener(e, function () {
        document.querySelectorAll('.drop_area').forEach((el) => {
          el.classList.remove('active');
        });
      }, false);
    });
  }
  function key_change() {
    document.addEventListener('keydown', function (e) {
      switch (e.keyCode) {
        case 116: // refresh on F5
          if (!e.ctrlKey) {
            e.preventDefault();
            refresh_h();
          }
          break;

        case 192: // open cli on `
          if (focused) {
            e.preventDefault();
            toggleCLI();
          }
          break;

        default:
          break;
      }
      //log(e.keyCode);
    });
  }
  function handle_back() {
    window.history.pushState({ page: 1 }, "", "");
    window.onpopstate = function (e) {
      window.history.pushState({ page: 1 }, "", "");
      back_h();
    }
  }
  function update_ip() {
    /*NON-ESP*/
    if (!Boolean(window.webkitRTCPeerConnection || window.mozRTCPeerConnection)) return;
    getLocalIP().then((ip) => {
      if (ip.indexOf("local") < 0) {
        EL('local_ip').value = ip;
        hub.cfg.local_ip = ip;
      }
      return;
    });
    /*/NON-ESP*/

    if (isESP()) {
      EL('local_ip').value = window_ip();
      hub.cfg.local_ip = window_ip();
    }
  }
}
function startup() {
  render_selects();
  render_info();
  apply_cfg();
  update_theme();
  show_screen('main');
  if ('Notification' in window && Notification.permission == 'default') Notification.requestPermission();
  load_devices();
  render_devices();
  hub.begin();
  discover();

  /*NON-ESP*/
  if (isSSL()) {
    display('http_only_http', 'block');
    display('http_settings', 'none');
    display('pwa_unsafe', 'none');
  }
  if (isPWA() || isLocal() || isApp()) {
    display('pwa_block', 'none');
  }
  if (isApp()) display('app_block', 'none');

  serial_check_ports();
  /*/NON-ESP*/
}

// =================== FUNC ===================
function discover() {
  for (let dev of hub.devices) {
    let id = dev.info.id;
    EL(`device#${id}`).className = "device offline";
    display(`Serial#${id}`, 'none');
    display(`BT#${id}`, 'none');
    display(`HTTP#${id}`, 'none');
    display(`MQTT#${id}`, 'none');
  }

  if (isESP()) {
    let esplocal = false;
    for (let dev of hub.devices) {
      if (window.location.href.includes(dev.info.ip)) esplocal = true;
    }
    if (!esplocal) hub.http.discover_ip(window_ip(), hub.cfg.http_port);
  }
  spinArrows(true);
  hub.discover();
}
function discover_all() {
  spinArrows(true);
  hub.discover_all();
}