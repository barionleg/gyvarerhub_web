
let prev_set = null;

function applyUpdate(name, value) {
  if (screen != 'device') return;
  if (prev_set && prev_set.name == name && prev_set.value == value) {
    prev_set = null;
    return;
  }
  if (name in prompts) {
    release_all();
    let res = prompt(value ? value : prompts[name].label, prompts[name].value);
    if (res !== null) {
      prompts[name].value = res;
      set_h(name, res);
    }
    return;
  }
  if (name in confirms) {
    release_all();
    let res = confirm(value ? value : confirms[name].label);
    set_h(name, res ? 1 : 0);
    return;
  }
  if (name in pickers) {
    pickers[name].setColor(intToCol(value));
    return;
  }

  let el = EL('#' + name);
  if (!el) return;
  cl = el.classList;
  if (cl.contains('icon_t')) el.style.color = value;
  else if (cl.contains('text_t')) el.innerHTML = value;
  else if (cl.contains('input_t')) el.value = value;
  else if (cl.contains('date_t')) el.value = new Date(value * 1000).toISOString().split('T')[0];
  else if (cl.contains('time_t')) el.value = new Date(value * 1000).toISOString().split('T')[1].split('.')[0];
  else if (cl.contains('datetime_t')) el.value = new Date(value * 1000).toISOString().split('.')[0];
  else if (cl.contains('slider_t')) el.value = value, EL('out#' + name).innerHTML = value, moveSlider(el, false);
  else if (cl.contains('switch_t')) el.checked = (value == '1');
  else if (cl.contains('select_t')) el.value = value;
  else if (cl.contains('image_t')) {
    files.push({ id: '#' + name, path: (value ? value : EL('#' + name).getAttribute("name")), type: 'img' });
    EL('wlabel#' + name).innerHTML = ' [0%]';
    if (files.length == 1) nextFile();
  }
  else if (cl.contains('canvas_t')) {
    if (name in canvases) {
      if (!canvases[name].value) {
        canvases[name].value = value;
        drawCanvas(canvases[name]);
      }
    }
  }
  else if (cl.contains('gauge_t')) {
    if (name in gauges) {
      gauges[name].value = Number(value);
      drawGauge(gauges[name]);
    }
  }
  else if (cl.contains('flags_t')) {
    let flags = document.getElementById('#' + name).getElementsByTagName('input');
    let val = value;
    for (let i = 0; i < flags.length; i++) {
      flags[i].checked = val & 1;
      val >>= 1;
    }
  }
}

function parseDevice(fromID, text, conn, ip = 'unset') {
  switch (device.type) {
    case 'print':
      if (id != focused) return;
      printCLI(device.text, device.color);
      break;

    case 'update':
      if (id != focused) return;
      if (!(id in devices)) return;
      for (let name in device.updates) applyUpdate(name, device.updates[name]);
      break;

    case 'info':
      if (id != focused) return;
      showInfo(device);
      break;

    // ============== FS ==============
    case 'fsbr':
      if (id != focused) return;
      showFsbr(device);
      break;

    case 'fs_error':
      if (id != focused) return;
      EL('fsbr_inner').innerHTML = '<div class="fs_err">FS ERROR</div>';
      break;

    // ============= FETCH =============
    case 'fetch_start':
      if (id != focused) return;

      fetching = focused;
      fetch_file = '';
      post('fetch_chunk', fetch_path);
      reset_fetch_tout();
      break;

    case 'fetch_next_chunk':
      if (id != fetching) return;

      fetch_file += device.data;
      if (device.chunk == device.amount - 1) {
        if (fetch_to_file) downloadFileEnd(fetch_file);
        else fetchEnd(fetch_name, fetch_index, fetch_file);
      } else {
        let perc = Math.round(device.chunk / device.amount * 100);
        if (fetch_to_file) processFile(perc);
        else EL('process#' + fetch_index).innerHTML = perc + '%';
        post('fetch_chunk', fetch_path);
        reset_fetch_tout();
      }
      break;

    case 'fetch_err':
      if (id != focused) return;

      if (fetch_to_file) errorFile();
      else EL('process#' + fetch_index).innerHTML = 'Aborted';
      showPopupError('Fetch aborted');
      stopFS();
      break;

    // ============= UPLOAD =============
    case 'upload_err':
      showPopupError('Upload aborted');
      setLabelTout('file_upload_btn', 'Error!', 'Upload');
      stopFS();
      break;

    case 'upload_start':
      if (id != focused) return;
      uploading = focused;
      uploadNextChunk();
      reset_upload_tout();
      break;

    case 'upload_next_chunk':
      if (id != uploading) return;
      uploadNextChunk();
      reset_upload_tout();
      break;

    case 'upload_end':
      showPopup('Upload Done!');
      stopFS();
      setLabelTout('file_upload_btn', 'Done!', 'Upload');
      post('fsbr');
      break;

    // ============= OTA =============
    case 'ota_err':
      showPopupError('Ota aborted');
      setLabelTout('ota_label', 'ERROR', 'IDLE');
      stopFS();
      break;

    case 'ota_start':
      if (id != focused) return;
      uploading = focused;
      otaNextChunk();
      reset_ota_tout();
      break;

    case 'ota_next_chunk':
      if (id != uploading) return;
      otaNextChunk();
      reset_ota_tout();
      break;

    case 'ota_end':
      showPopup('OTA Done! Reboot');
      stopFS();
      setLabelTout('ota_label', 'DONE', 'IDLE');
      break;

    // ============ OTA URL ============
    case 'ota_url_ok':
      showPopup('OTA Done!');
      break;

    case 'ota_url_err':
      showPopupError('OTA Error!');
      break;
  }
}


function showInfo(device) {
  function addInfo(el, label, value, title = '') {
    EL(el).innerHTML += `
    <div class="cfg_row info">
      <label>${label}</label>
      <label title="${title}" class="lbl_info">${value}</label>
    </div>`;
  }
  EL('info_version').innerHTML = '';
  EL('info_net').innerHTML = '';
  EL('info_memory').innerHTML = '';
  EL('info_system').innerHTML = '';

  for (let i in device.info.version) addInfo('info_version', i, device.info.version[i]);
  for (let i in device.info.net) addInfo('info_net', i, device.info.net[i]);
  for (let i in device.info.memory) {
    if (typeof (device.info.memory[i]) == 'object') {
      let used = device.info.memory[i][0];
      let total = device.info.memory[i][1];
      let mem = (used / 1000).toFixed(1) + ' kB';
      if (total) mem += ' [' + (used / total * 100).toFixed(0) + '%]';
      addInfo('info_memory', i, mem, `Total ${(total / 1000).toFixed(1)} kB`);
    } else addInfo('info_memory', i, device.info.memory[i]);
  }
  for (let i in device.info.system) {
    if (i == 'Uptime') {
      let sec = device.info.system[i];
      let upt = Math.floor(sec / 86400) + ':' + new Date(sec * 1000).toISOString().slice(11, 19);
      let d = new Date();
      let utc = d.getTime() - (d.getTimezoneOffset() * 60000);
      addInfo('info_system', i, upt);
      addInfo('info_system', 'Started', new Date(utc - sec * 1000).toISOString().split('.')[0].replace('T', ' '));
      continue;
    }
    addInfo('info_system', i, device.info.system[i]);
  }
}
function setLabelTout(el, text1, text2) {
  EL(el).innerHTML = text1;
  setTimeout(() => EL(el).innerHTML = text2, 3000);
}