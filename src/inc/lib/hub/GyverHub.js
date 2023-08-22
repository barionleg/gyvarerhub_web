class GyverHub {
  // callbacks
  onUpdate(id, name, value) { }
  onSaveDevices() { }
  onAddDevice(dev) { }
  onUpdDevice(dev) { }
  onDiscoverEnd() { }
  onPacket(id, type, data, conn) { }
  onConnectionChange(id, state) { }
  onWaitAnswer(id, state) { }
  onPingLost(id) { }

  // vars
  devices = [];
  cfg = {
    prefix: 'MyDevices', client_id: new Date().getTime().toString(16).slice(-8),
    use_local: false, local_ip: '192.168.1.1', netmask: 24, local_port: 80,
    use_bt: false,
    use_serial: false, baudrate: 115200,
    use_mqtt: false, mq_host: 'test.mosquitto.org', mq_port: '8081', mq_login: '', mq_pass: '',
  };

  constructor() {
    this.mqtt = new MQTTconn(this);
    this.http = new HTTPconn(this);
    this.serial = new SERIALconn(this);
    this.bt = new BTconn(this);
    this.ws = new WSconn(this);
  }

  parse(conn, data, from_id = null, ip = null, port = null) {
    data = data.trim()
      .replaceAll(/([^\\])\\([^\"\\nrt])/ig, "$1\\\\$2")
      .replaceAll(/\t/ig, "\\t")
      .replaceAll(/\n/ig, "\\n")
      .replaceAll(/\r/ig, "\\r");

    try {
      data = JSON.parse(data);
    } catch (e) {
      this.err('Wrong packet (JSON):' + e);
      return;
    }

    // from_id == null - discover all / broadcast mqtt
    if (!data.id) return this.err('Wrong packet (ID)');
    if (from_id != null && from_id != data.id) return log('Wrong packet (Unknown ID)');
    if (from_id == null && data.type != 'discover' && data.type != 'update' && data.type != 'push' && data.type != 'print' && data.type != 'data') return log('Wrong packet (error)');

    let type = data.type;
    delete data.type;
    let dev = this.dev(data.id);
    if (dev) dev.parse(type, data);

    if (type == 'discover') {
      if (from_id == null) data.prefix = this.cfg.prefix;
      if (conn == Conn.HTTP) {
        data.ip = ip;
        data.port = port;
      }
      let flag = false;
      if (dev) {  // exists
        for (let key in data) {
          if (dev.info[key] != data[key]) {
            dev.info[key] = data[key];
            flag = true;
          }
        }
        if (dev.conn > conn) {  // priority
          dev.conn = conn;
          flag = true;
        }
        if (flag) this.onUpdDevice(dev.info);
      } else {
        dev = new Device(this);
        for (let key in data) {
          dev.info[key] = data[key];
        }
        dev.conn = conn;
        this.devices.push(dev);
        this.onAddDevice(dev.info);
        flag = true;
      }
      if (flag) {
        /*NON-ESP*/
        this.mqtt.sub_device(dev.info.prefix, dev.info.id);
        /*/NON-ESP*/
        this.onSaveDevices();
      }
    }

    this.onPacket(data.id, type, data, conn);
  }

  begin() {
    /*NON-ESP*/
    if (this.cfg.use_mqtt) this.mqtt.start();
    setInterval(() => this.mqtt.start(), 5000); // safe
    /*/NON-ESP*/
  }

  // network
  post(id, cmd, name = '', value = '') {
    this.dev(id).post(cmd, name, value);
  }
  _checkDiscoverEnd() {
    if (!this.http.discovering &&
      !this.mqtt.discovering &&
      !this.serial.discovering &&
      !this.bt.discovering) this.onDiscoverEnd();
  }
  discover() {
    /*NON-ESP*/
    if (this.cfg.use_mqtt) this.mqtt.discover();
    if (this.cfg.use_serial) this.serial.discover();
    if (this.cfg.use_bt) this.bt.discover();
    /*/NON-ESP*/
    if (this.cfg.use_local && !isSSL()) this.http.discover();
  }
  discover_all() {
    /*NON-ESP*/
    if (this.cfg.use_mqtt) this.mqtt.discover_all();
    if (this.cfg.use_serial) this.serial.discover_all();
    if (this.cfg.use_bt) this.bt.discover_all();
    /*/NON-ESP*/
    if (this.cfg.use_local && !isSSL()) this.http.discover_all();
  }

  // device getter
  devinf(id) {
    let dev = this.dev(id);
    return dev ? dev.info : null;
  }
  dev(id) {
    if (!id) return null;
    for (let d of this.devices) {
      if (d.info.id == id) return d;
    }
    return null;
  }

  // devices
  export() {
    let devs = [];
    for (let d of this.devices) {
      devs.push(d.info);
    }
    return JSON.stringify(devs);
  }
  import(str) {
    let devsi = JSON.parse(str);
    this.devices = [];
    for (let di of devsi) {
      let dev = new Device(this);
      for (let key in di) {
        dev.info[key] = di[key];
      }
      this.devices.push(dev);
    }
  }
  delete(id) {
    for (let i in this.devices) {
      if (this.devices[i].info.id == id) {
        this.devices.splice(i, 1);
        this.onSaveDevices();
        return;
      }
    }
  }

  // log
  log(t) {
    console.log('Log: ' + t);
  }
  err(e) {
    console.log('Error: ' + e);
  }
};

let hub = new GyverHub();