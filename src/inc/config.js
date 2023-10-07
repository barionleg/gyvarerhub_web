function update_cfg(el) {
  if (el.type == 'text') el.value = el.value.trim();
  let val = (el.type == 'checkbox') ? el.checked : el.value;
  if (el.id in cfg) cfg[el.id] = val;
  else if (el.id in hub.cfg) hub.cfg[el.id] = val;
  cfg_changed = true;
  update_theme();
}
function save_cfg() {
  localStorage.setItem('app_config', JSON.stringify(cfg));
  localStorage.setItem('hub_config', JSON.stringify(hub.cfg));
}
function load_cfg() {
  if (localStorage.hasOwnProperty('app_config')) {
    let skip_save = true;
    let cfg_r = JSON.parse(localStorage.getItem('app_config'));

    if (cfg_r.version != cfg.version) {
      cfg_r.version = cfg.version;
      skip_save = false;
      setTimeout(() => alert('Версия ' + app_version + '!\n' + '__NOTES__'), 1000);
    }
    if (Object.keys(cfg).length == Object.keys(cfg_r).length) { // no changes
      cfg = cfg_r;
      if (skip_save) return;
    }
  }
  localStorage.setItem('app_config', JSON.stringify(cfg));
}
function load_cfg_hub() {
  if (localStorage.hasOwnProperty('hub_config')) {
    let cfg_r = JSON.parse(localStorage.getItem('hub_config'));
    if (Object.keys(hub.cfg).length == Object.keys(cfg_r).length) { // no changes
      hub.cfg = cfg_r;
      return;
    }
  }
  localStorage.setItem('hub_config', JSON.stringify(hub.cfg));
}
function apply_cfg() {
  for (let key in cfg) {
    if (key == 'version') continue;
    let el = EL(key);
    if (el == undefined) continue;
    if (el.type == 'checkbox') el.checked = cfg[key];
    else el.value = cfg[key];
  }
  for (let key in hub.cfg) {
    let el = EL(key);
    if (el == undefined) continue;
    if (el.type == 'checkbox') el.checked = hub.cfg[key];
    else el.value = hub.cfg[key];
  }
}
async function cfg_export() {
  try {
    const text = btoa(JSON.stringify(cfg)) + ';' + btoa(JSON.stringify(hub.cfg)) + ';' + btoa(encodeURIComponent(hub.export()));
    await navigator.clipboard.writeText(text);
    showPopup('Copied to clipboard');
  } catch (e) {
    showPopupError('Export error');
  }
}
async function cfg_import() {
  try {
    let text = await navigator.clipboard.readText();
    text = text.split(';');
    try {
      cfg = JSON.parse(atob(text[0]));
    } catch (e) { }
    try {
      hub.cfg = JSON.parse(atob(text[1]));
    } catch (e) { }
    try {
      hub.import(decodeURIComponent(atob(text[2])));
    } catch (e) { }

    save_cfg();
    save_devices();
    showPopup('Import done');
    setTimeout(() => location.reload(), 1500);
  } catch (e) {
    showPopupError('Wrong data');
  }
}
function update_theme() {
  let v = themes[cfg.theme];
  let r = document.querySelector(':root');
  r.style.setProperty('--back', theme_cols[v][0]);
  r.style.setProperty('--tab', theme_cols[v][1]);
  r.style.setProperty('--font', theme_cols[v][2]);
  r.style.setProperty('--font2', theme_cols[v][3]);
  r.style.setProperty('--dark', theme_cols[v][4]);
  r.style.setProperty('--thumb', theme_cols[v][5]);
  r.style.setProperty('--black', theme_cols[v][6]);
  r.style.setProperty('--scheme', theme_cols[v][7]);
  r.style.setProperty('--font_inv', theme_cols[v][8]);
  r.style.setProperty('--shad', theme_cols[v][9]);
  r.style.setProperty('--ui_width', cfg.ui_width + 'px');
  r.style.setProperty('--prim', intToCol(colors[cfg.maincolor]));
  r.style.setProperty('--font_f', cfg.font);

  let b = 'block';
  let n = 'none';
  let f = 'var(--font)';
  let f3 = 'var(--font3)';

  display('local_block', hub.cfg.use_local ? b : n);
  EL('local_label').style.color = hub.cfg.use_local ? f : f3;
  display('pin_block', cfg.use_pin ? b : n);
  EL('pin_label').style.color = cfg.use_pin ? f : f3;

  /*NON-ESP*/
  display('mq_block', hub.cfg.use_mqtt ? b : n);
  EL('mqtt_label').style.color = hub.cfg.use_mqtt ? f : f3;
  display('bt_block', hub.cfg.use_bt ? b : n);
  EL('bt_label').style.color = hub.cfg.use_bt ? f : f3;
  display('serial_block', hub.cfg.use_serial ? b : n);
  EL('serial_label').style.color = hub.cfg.use_serial ? f : f3;
  /*/NON-ESP*/
}
function save_devices() {
  localStorage.setItem('devices', hub.export());
}
function load_devices() {
  if (localStorage.hasOwnProperty('devices')) {
    hub.import(localStorage.getItem('devices'));
  }
}