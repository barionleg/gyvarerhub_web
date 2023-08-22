window.onload = function () {
  render_main(app_version);
  EL('title').innerHTML = app_title;
  let title = 'GyverHub v' + app_version + ' [' + hub.cfg.client_id + '] ' + (isPWA() ? 'PWA ' : '') + (isSSL() ? 'SSL ' : '') + (isLocal() ? 'Local ' : '') + (isESP() ? 'ESP ' : '') + (isApp() ? 'App ' : '');
  EL('title').title = title;

  load_cfg();
  load_hcfg();
  if (isESP()) hub.cfg.use_local = true;
  update_ip();
  update_theme();
  set_drop();
  key_change();
  handle_back();
  register_SW();
  if (hub.cfg.use_pin) show_keypad(true);
  else startup();

  function register_SW() {
    /*NON-ESP*/
    if ('serviceWorker' in navigator && !isLocal() && !isApp()) {
      navigator.serviceWorker.register('/sw.js');
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
    EL('http_only_http').style.display = 'block';
    EL('http_settings').style.display = 'none';
    EL('pwa_unsafe').style.display = 'none';
  }
  if (isPWA() || isLocal() || isApp()) {
    EL('pwa_block').style.display = 'none';
  }
  if (isApp()) EL('app_block').style.display = 'none';

  // serial_change();

  /*/NON-ESP*/
}
function discover() {
  for (let dev of hub.devices) {
    dev.conn = Conn.NONE;
    let id = dev.info.id;
    EL(`device#${id}`).className = "device offline";
    display(`Serial#${id}`, 'none');
    display(`BT#${id}`, 'none');
    display(`HTTP#${id}`, 'none');
    display(`MQTT#${id}`, 'none');
  }

  if (isESP()) {
    let has = false;
    for (let dev of hub.devices) {
      if (window.location.href.includes(dev.info.ip)) has = true;
    }
    if (!has && checkIP(window_ip())) hub.http.discover_ip(window_ip(), hub.cfg.local_port);
  }
  hub.discover();
  spinArrows(true);
}
function discover_all() {
  hub.discover_all();
  spinArrows(true);
}

// events
hub.mqtt.onConnChange = (state) => {
  EL('mqtt_ok').style.display = state ? 'inline-block' : 'none';
}
hub.bt.onConnChange = (state) => {
  switch (state) {
    case 'connecting':
      EL('bt_device').innerHTML = 'Connecting...';
      break;

    case 'open':
      EL('bt_btn').innerHTML = 'Disconnect';
      EL('bt_device').innerHTML = hub.bt.getName();
      bt_show_ok(true);
      break;

    case 'close':
      EL('bt_btn').innerHTML = 'Connect';
      EL('bt_device').innerHTML = 'Not Connected';
      bt_show_ok(false);
      break;

    case 'error':
      EL('bt_device').innerHTML = 'Not Connected';
      bt_show_ok(false);
      break;
  }
}


hub.onSaveDevices = () => save_devices();
hub.onAddDevice = (dev) => addDevice(dev);
hub.onUpdDevice = (dev) => {
  /*NON-ESP*/
  if (dev.icon.length) EL(`icon#${dev.id}`).innerHTML = dev.icon;
  /*/NON-ESP*/
  EL(`name#${dev.id}`).innerHTML = dev.name ? dev.name : 'Unknown';
  EL(`device#${dev.id}`).title = `${dev.id} [${dev.prefix}]`;
}
hub.onConnectionChange = (id, state) => {
  if (id == focused) errorBar(!state);
}
hub.onWaitAnswer = (id, state) => {
  if (id == focused) spinArrows(state);
}
hub.onPingLost = (id) => {
  if (id == focused) hub.dev(id).post(screen == 'device' ? 'focus' : screen);
}
hub.onDiscoverEnd = () => {
  if (screen == 'main') spinArrows(false);
}
hub.onPacket = (id, type, data, conn) => {
  switch (type) {
    case 'discover':
      EL(`device#${id}`).className = "device";
      EL(`${Conn.names[conn]}#${id}`).style.display = 'inline-block';
      break;

    case 'ui':
      showControls(data.controls, false, conn, hub.devinf(id).ip);
      break;

    case 'data':
      // RAW DATA
      break;

    case 'alert':
      release_all();
      alert(data.text);
      break;

    case 'notice':
      showPopup(data.text, intToCol(data.color));
      break;

    case 'ERR':
      showPopupError(data.text);
      break;

    case 'push':
      let date = (new Date).getTime();
      if (date - push_timer > 3000) {
        push_timer = date;
        showNotif(data.text, hub.devinf(id).name);
      }
      break;
  }
}