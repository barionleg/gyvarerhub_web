class Device {
  tout_prd = 2800;
  ping_prd = 3000;

  constructor(hub) {
    this._hub = hub;
    this.ws = new WSconn(this);
    this.mq_buf = new PacketBuffer(hub, Conn.MQTT);
    this.ws_buf = new PacketBuffer(hub, Conn.HTTP);
  }

  info = {
    id: null,
    prefix: null,
    name: null,
    icon: null,
    PIN: null,
    version: null,
    max_upl: null,
    modules: null,
    ota_t: null,
    ip: null,
    http_port: null,
    ws_port: null,
    break_widgets: false,
    show_names: false,
  };

  connected() {
    return !this.conn_lost;
  }
  module(mod) {
    return !(this.info.modules & mod);
  }
  post(cmd, name = '', value = '') {
    cmd = cmd.toString();
    name = name.toString();
    value = value.toString();

    if (cmd == 'set') {
      if (!this.module(Modules.SET)) return;
      if (name) this.prev_set[name] = Date.now();
    }

    let uri0 = this.info.prefix + '/' + this.info.id + '/' + this._hub.cfg.client_id + '/' + cmd;
    let uri = uri0;
    if (name) {
      uri += '/' + name;
      if (value) uri += '=' + value;
    }

    switch (this.conn) {
      case Conn.HTTP:
        if (this.ws.state()) this.ws.send(uri);
        else this._hub.http.send(this.info.ip, this.info.http_port, `hub/${uri}`);
        break;

      /*NON-ESP*/
      case Conn.SERIAL:
        this._hub.serial.send(uri);
        break;

      case Conn.BT:
        this._hub.bt.send(uri);
        break;

      case Conn.MQTT:
        this._hub.mqtt.send(uri0 + (name.length ? ('/' + name) : ''), value);
        break;
      /*/NON-ESP*/
    }

    if (this.focused) {
      this._reset_ping();
      this._reset_tout();
    }
  }
  focus() {
    this.focused = true;
    this.post('ui');
    if (this.conn == Conn.HTTP && this.info.ws_port) this.ws.start();
  }
  unfocus() {
    this.focused = false;
    this._stop_ping();
    this._stop_tout();
    this.post('unfocus');
    if (this.conn == Conn.HTTP) this.ws.stop();
  }

  // fs
  fsStop() {
    this.fs_mode = null;
    if (this.fs_tout) clearTimeout(this.fs_tout);
  }
  fsBusy() {
    return !!this.fs_mode;
  }
  
  upload(file, path) {
    if (this.fsBusy()) {
      this._hub.onFsUploadError(this.info.id, 'FS busy');
      return;
    }

    let reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (e) => {
      if (!e.target.result) return;
      let buffer = new Uint8Array(e.target.result);
      if (!path.startsWith('/')) path = '/' + path;
      if (!path.endsWith('/')) path += '/';
      path += file.name;

      if (!confirm('Upload ' + path + ' (' + buffer.length + ' bytes)?')) {
        this._hub.onFsUploadError(this.info.id, 'Upload cancelled');
        return;
      }
      this._hub.onFsUploadStart(this.info.id);
      this.fs_mode = 'upload';

      if (this.conn == Conn.HTTP) {
        let formData = new FormData();
        formData.append('upload', file);
        http_post(`http://${this.info.ip}:${this.info.http_port}/hub/upload?path=${path}`, formData)
          .then((v) => { this._hub.onFsUploadEnd(this.info.id, v); this.post('fsbr'); })
          .catch((e) => this._hub.onFsUploadError(this.info.id, e))
          .finally(() => this.fsStop());
      } else {
        this.upl_bytes = Array.from(buffer);
        this.upl_size = this.upl_bytes.length;
        this.post('upload', path);
      }
    }
  }
  uploadOta(file, type) {
    if (this.fsBusy()) {
      this._hub.onOtaError(this.info.id, 'FS busy');
      return;
    }
    if (!file.name.endsWith(this.info.ota_t)) {
      alert('Wrong file! Use .' + this.info.ota_t);
      return;
    }
    if (!confirm('Upload OTA ' + type + '?')) return;

    let reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (e) => {
      if (!e.target.result) return;
      this._hub.onOtaStart(this.info.id);
      this.fs_mode = 'ota';

      if (this.conn == Conn.HTTP) {
        let formData = new FormData();
        formData.append(type, file);
        http_post(`http://${this.info.ip}:${this.info.http_port}/hub/ota?type=${type}`, formData)
          .then(() => this._hub.onOtaEnd(this.info.id))
          .catch((e) => this._hub.onOtaError(this.info.id, e))
          .finally(() => this.fsStop());
      } else {
        let buffer = new Uint8Array(e.target.result);
        this.upl_bytes = Array.from(buffer);
        this.upl_size = this.upl_bytes.length;
        this.post('ota', type);
      }
    }
  }
  fetchFs(idx, path) {
    let id = this.info.id;
    if (this.fsBusy()) {
      this._hub.onFsFetchError(id, 'FS busy');
      return;
    }

    this.fs_mode = 'fetch';
    this.fet_name = path.split('/').pop();
    this.fet_index = idx;
    this.fet_to_fs = true;

    if (this.conn == Conn.HTTP) {
      http_fetch_blob(`http://${this.info.ip}:${this.info.http_port}/hub/fetch?path=${path}`,
        perc => this._hub.onFsFetchPerc(id, idx, perc))
        .then(res => this._hub.onFsFetchEnd(id, this.fet_name, idx, res))
        .catch(e => this._hub.onFsFetchError(id, idx, e))
        .finally(() => this.fsStop());
    } else {
      this.post('fetch', path);
    }
    this._hub.onFsFetchStart(id, idx);
  }

  // file
  resetFiles() {
    this.files = [];
    this.fsStop();
  }
  addFile(name, path, type, force = false) {
    this.files.push({ name: name, path: path, type: type });
    if (force && this.files.length == 1) this.fetchNextFile();
  }
  fetchNextFile() {
    if (!this.files.length) return;

    let id = this.info.id;
    if (this.fsBusy()) {
      this._hub.onFsFetchError(id, 'FS busy');
      return;
    }

    this.fet_to_fs = false;
    this.fs_mode = 'fetch';
    let file = this.files[0];
    this._hub.onFetchStart(id, file.name);

    if (this.conn == Conn.HTTP) {
      http_fetch_blob(`http://${this.info.ip}:${this.info.http_port}/hub/fetch?path=${file.path}`,
        perc => this._hub.onFetchPerc(id, file.name, perc))
        .then(res => this._hub.onFetchEnd(id, file.name, file.type, `data:${getMime(file.path)};base64,${res}`))
        .catch(e => this._hub.onFetchError(id, file.name))
        .finally(() => this._nextFile());
    } else {
      post('fetch', file.path);
    }
  }

  // private
  _nextFile() {
    this.fsStop();
    this.files.shift();
    this.fetchNextFile();
  }
  _checkUpdate(name) {
    return this.prev_set[name] && Date.now() - this.prev_set[name] < this.tout_prd;
  }
  _parse(type, data) {
    let id = this.info.id;
    this._stop_tout();
    if (this.conn_lost) {
      this.conn_lost = false;
      if (this.focused) this._hub.onDeviceConnChange(id, true);
    }

    switch (type) {
      case 'OK':
        break;

      case 'ack':
        break;

      case 'ui':
        this.controls = data.controls;
        break;

      case 'update':
        for (let name in data.updates) {
          if (this._checkUpdate(name)) continue;
          this._hub.onUpdate(id, name, data.updates[name]);
        }
        break;

      // ============= UPLOAD =============
      case 'upload_start':
      case 'upload_next_chunk':
        if (this.fs_mode != 'upload') break;
        this._uploadNextChunk();
        this._fsToutStart();
        break;

      case 'upload_end':
        if (this.fs_mode != 'upload') break;
        this._hub.onFsUploadEnd(id, 'Upload done');
        this.post('fsbr');
        this.fsStop();
        break;

      case 'upload_err':
        if (this.fs_mode != 'upload') break;
        this._hub.onFsUploadError(id, 'Upload aborted');
        this.fsStop();
        break;

      // ============= FETCH =============
      case 'fetch_start':
        if (this.fs_mode != 'fetch') break;
        this.fet_buf = '';
        this.post('fetch_chunk');
        this._fsToutStart();
        break;

      case 'fetch_next_chunk':
        if (this.fs_mode != 'fetch') break;
        this.fet_buf += data.data;
        if (data.chunk == data.amount - 1) {
          if (this.fet_to_fs) this._hub.onFsFetchEnd(id, this.fet_name, this.fet_index, this.fet_buf);
          else {
            let file = this.files[0];
            this._hub.onFetchEnd(id, file.name, file.type, `data:${getMime(file.path)};base64,${this.fet_buf}`);
            this._nextFile();
          }
          this.fsStop();
        } else {
          let perc = Math.round(data.chunk / data.amount * 100);
          if (this.fet_to_fs) this._hub.onFsFetchPerc(id, this.fet_index, perc);
          else this._hub.onFetchPerc(id, this.files[0].name, perc);
          this.post('fetch_chunk');
          this._fsToutStart();
        }
        break;

      case 'fetch_err':
        if (this.fs_mode != 'fetch') break;
        if (this.fet_to_fs) {
          this._hub.onFsFetchError(id, this.fet_index, 'Fetch aborted');
          this.fsStop();
        } else {
          this._hub.onFetchError(id, this.files[0].name);
          this._nextFile();
        }
        break;

      // ============= OTA =============
      case 'ota_start':
      case 'ota_next_chunk':
        if (this.fs_mode != 'ota') break;
        this._otaNextChunk();
        this._fsToutStart();
        break;

      case 'ota_end':
        if (this.fs_mode != 'ota') break;
        this._hub.onOtaEnd(id);
        this.fsStop();
        break;

      case 'ota_err':
        if (this.fs_mode != 'ota') break;
        this._hub.onOtaError(id, 'OTA aborted');
        this.fsStop();
        break;
    }
  }
  _stop_tout() {
    if (this.tout) {  // waiting answer
      this._hub.onWaitAnswer(this.info.id, false);
      clearTimeout(this.tout);
      this.tout = null;
    }
  }
  _reset_tout() {
    if (this.tout) return;
    this._hub.onWaitAnswer(this.info.id, true);
    this.tout = setTimeout(() => {
      if (this.focused && !this.fsBusy()) this._hub.onDeviceConnChange(this.info.id, false);
      this.conn_lost = true;
      this._stop_tout();
    }, this.tout_prd);
  }
  _stop_ping() {
    if (this.ping) clearInterval(this.ping);
    this.ping = null;
  }
  _reset_ping() {
    this._stop_ping();
    this.ping = setInterval(() => {
      if (this.conn_lost && !this.fsBusy()) this._hub.onPingLost(this.info.id);
      else this.post('ping');
    }, this.ping_prd);
  }
  _otaNextChunk() {
    let i = 0;
    let data = '';
    while (true) {
      if (!this.upl_bytes.length) break;
      i++;
      data += String.fromCharCode(this.upl_bytes.shift());
      if (i >= this.info.max_upl * 3 / 4) break;
    }
    this._hub.onOtaPerc(this.info.id, Math.round((this.upl_size - this.upl_bytes.length) / this.upl_size * 100));
    this.post('ota_chunk', (this.upl_bytes.length) ? 'next' : 'last', window.btoa(data));
  }
  _uploadNextChunk() {
    let i = 0;
    let data = '';
    while (true) {
      if (!this.upl_bytes.length) break;
      i++;
      data += String.fromCharCode(this.upl_bytes.shift());
      if (i >= this.info.max_upl * 3 / 4) break;
    }
    this._hub.onFsUploadPerc(this.info.id, Math.round((this.upl_size - this.upl_bytes.length) / this.upl_size * 100));
    this.post('upload_chunk', (this.upl_bytes.length) ? 'next' : 'last', window.btoa(data));
  }
  _fsToutStart() {
    if (this.fs_tout) clearTimeout(this.fs_tout);
    this.fs_tout = setTimeout(() => {
      switch (this.fs_mode) {
        case 'upload':
          this._hub.onFsUploadError(this.info.id, 'Upload timeout');
          break;
        case 'fetch':
          this._hub.onFsFetchError(this.info.id, 'Fetch timeout');
          break;
        case 'ota':
          this._hub.onOtaError(this.info.id, 'OTA timeout');
          break;
      }
      this.fsStop();
    }, this.tout_prd);
  }

  conn = Conn.NONE;
  controls = null;
  granted = false;
  focused = false;
  tout = null;
  ping = null;
  conn_lost = false;
  prev_set = {};
  fs_mode = null;   // upload, fetch, ota
  fs_tout = null;
  upl_bytes = null;
  upl_size = null;
  fet_name = '';
  fet_index = 0;
  fet_buf = '';
  fet_to_fs = true;
  files = [];
};