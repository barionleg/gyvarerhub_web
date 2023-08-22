class Device {
  tout_prd = 2800;
  ping_prd = 3000;

  constructor(hub) {
    this._hub = hub;
  }

  conn = Conn.NONE;
  controls = null;
  granted = false;
  focused = false;
  tout = null;
  ping = null;
  conn_lost = false;
  ws = null;

  buffer = {
    WS: '', MQTT: '', Serial: '', BT: ''
  };

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
    port: null,
    ws_port: null,
    break_widgets: false,
    show_names: false,
  };

  module(mod) {
    return !(this.info.modules & mod);
  }
  post(cmd, name = '', value = '') {
    if (cmd == 'set' && !this.module(Modules.SET)) return;

    // if (cmd == 'set') {
    //   if (set_tout) clearTimeout(set_tout);
    //   prev_set = { name: name, value: value };
    //   set_tout = setTimeout(() => { set_tout = prev_set = null; }, tout_prd);
    // }

    cmd = cmd.toString();
    name = name.toString();
    value = value.toString();
    let uri0 = this.info.prefix + '/' + this.info.id + '/' + this._hub.cfg.client_id + '/' + cmd;
    let uri = uri0;
    if (name) {
      uri += '/' + name;
      if (value) uri += '=' + value;
    }

    switch (this.conn) {
      case Conn.HTTP:
        if (this._hub.ws.state(this.info.id)) this._hub.ws.send(this.info.id, uri);
        else this._hub.http.send(this.info.id, this.info.ip, this.info.port, `hub/${uri}`);
        break;

      /*NON-ESP*/
      // case Conn.SERIAL:
      //   serial_send(uri);
      //   break;

      // case Conn.BT:
      //   bt_send(uri);
      //   break;

      case Conn.MQTT:
        this._hub.mqtt.send(uri0 + (name.length ? ('/' + name) : ''), value);
        break;
      /*/NON-ESP*/
    }

    if (this.focused) {
      this.reset_ping();
      this.reset_tout();
    }
  }
  parse(type, data) {
    this.stop_tout();
    if (this.conn_lost) {
      this.conn_lost = false;
      this._hub.onConnectionChange(this.info.id, true);
    }

    switch (type) {
      case 'ui':
        this.controls = data.controls;
        break;
    }
  }
  checkPacket(conn, data) {
    let checkBuffer = () => {
      let buf = this.buffer[Conn.names[conn]];
      if (buf.endsWith('}\n')) {
        if (buf.startsWith('\n{')) {
          this._hub.parse(conn, buf, this.info.id);
        }
        this.buffer[Conn.names[conn]] = '';
      }
    }

    if (conn == Conn.BT || conn == Conn.SERIAL) {
      for (let t of data) {
        this.buffer[Conn.names[conn]] += t;
        checkBuffer();
      }
    } else {
      this.buffer[Conn.names[conn]] += data;
      checkBuffer();
    }
  }

  // timeout
  stop_tout() {
    if (this.tout) {  // waiting answer
      this._hub.onWaitAnswer(this.info.id, false);
      clearTimeout(this.tout);
      this.tout = null;
    }
  }
  reset_tout() {
    if (this.tout) return;
    this._hub.onWaitAnswer(this.info.id, true);
    this.tout = setTimeout(() => {
      this._hub.onConnectionChange(this.info.id, false);
      this.conn_lost = true;
      this.stop_tout();
    }, this.tout_prd);
  }

  // ping
  stop_ping() {
    if (this.ping) {
      clearInterval(this.ping);
      this.ping = null;
    }
  }
  reset_ping() {
    this.stop_ping();
    this.ping = setInterval(() => {
      if (this.conn_lost) this._hub.onPingLost(this.info.id);
      else this.post('ping');
    }, this.ping_prd);
  }

  // focus
  focus() {
    this.focused = true;
    this.post('focus');
    if (this.conn == Conn.HTTP) this._hub.ws.start(this.info.id);
  }
  unfocus() {
    this.stop_ping();
    this.stop_tout();
    this.focused = false;
    this.post('unfocus');
    if (this.conn == Conn.HTTP) this._hub.ws.stop(this.info.id);
  }
};