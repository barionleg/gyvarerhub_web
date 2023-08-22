/*NON-ESP*/
class MQTTconn {
  connecting = false;
  client = null;
  discover_f = false;
  prefs = [];
  discovering = false;
  constructor(hub) {
    this._hub = hub;
  }

  // callback
  onConnChange(state) { }

  // discover
  discover() {
    if (this.discovering) return;
    if (!this.state()) this.discover_f = true;
    else {
      for (let dev of this._hub.devices) {
        this.send(dev.info.prefix + '/' + dev.info.id, this._hub.cfg.client_id);
      }
    }
    _discoverFlag(1000);
  }
  discover_all() {
    if (this.discovering) return;
    if (!this.state()) return;
    this.upd_prefix(this._hub.cfg.prefix);
    this.send(this._hub.cfg.prefix, this._hub.cfg.client_id);
    _discoverFlag(1000);
  }
  _discoverFlag(tout) {
    this.discovering = true;
    setTimeout(() => {
      this.discovering = false;
      this._hub._checkDiscoverEnd();
    }, tout);
  }

  // core
  send(topic, msg = '') {
    if (this.state()) this.client.publish(topic, msg);  // no '\0'
  }
  state() {
    return (this.client && this.client.connected);
  }
  stop() {
    if (this.state()) this.client.end();
  }
  start() {
    if (this.connecting || this.state() || !this._hub.cfg.mq_host || !this._hub.cfg.mq_port || !this._hub.cfg.use_mqtt) return;

    const url = 'wss://' + this._hub.cfg.mq_host + ':' + this._hub.cfg.mq_port + '/mqtt';
    const options = {
      keepalive: 60,
      clientId: 'HUB-' + Math.round(Math.random() * 0xffffffff).toString(16),
      username: this._hub.cfg.mq_login,
      password: this._hub.cfg.mq_pass,
      protocolId: 'MQTT',
      protocolVersion: 4,
      clean: true,
      reconnectPeriod: 3000,
      connectTimeout: 10 * 1000
    }

    try {
      this.log('Connecting');
      this.client = mqtt.connect(url, options);
    } catch (e) {
      this.err('Connection fail');
      this.onConnChange(0);
      return;
    }

    this.connecting = true;

    this.client.on('connect', () => {
      this.connecting = false;
      this.log('Connected');
      this.onConnChange(1);
      this.prefs = [];
      this.upd_prefix(this._hub.cfg.prefix);
      for (let dev of this._hub.devices) this.sub_device(dev.info.prefix, dev.info.id);

      if (this.discover_f) {
        this.discover_f = false;
        this.discover();
      }
    });

    this.client.on('error', () => {
      this.connecting = false;
      this.onConnChange(0);
      this.client.end();
      this.err('Error');
    });

    this.client.on('close', () => {
      this.connecting = false;
      this.onConnChange(0);
      this.client.end();
      this.log('Close');
    });

    this.client.on('message', (topic, text) => {
      topic = topic.toString();
      text = text.toString();
      let parts = topic.split('/');
      if (parts.length < 2) return;

      for (let pref of this.prefs) {
        if (parts[0] != pref || parts[1] != 'hub') continue;

        // prefix/hub
        if (parts.length == 2) {
          this._hub.parse(Conn.MQTT, text, null);
          return;

          // prefix/hub/client_id/id
        } else if (parts.length == 4 && parts[2] == this._hub.cfg.client_id) {
          let dev = this._hub.dev(parts[3]);
          if (dev) dev.checkPacket(Conn.MQTT, text);
          else this._hub.parse(Conn.MQTT, text, null);
          return;

          // prefix/hub/id/get/name
        } else if (parts.length == 5 && parts[3] == 'get') {
          this._hub.onUpdate(parts[2], parts[4], text);
          return;
        }
      }
    });
  }
  sub_device(prefix, id) {
    if (!this.state()) return;
    this.client.subscribe(prefix + '/hub/' + id + '/get/#');
    this.upd_prefix(prefix);
  }
  upd_prefix(prefix) {
    if (!this.prefs.includes(prefix)) {
      this.prefs.push(prefix);
      this.client.subscribe(prefix + '/hub');
      this.client.subscribe(prefix + '/hub/' + this._hub.cfg.client_id + '/#');
    }
  }

  // log
  log(t) {
    this._hub.log('[MQTT] ' + t);
  }
  err(e) {
    this._hub.err('[MQTT] ' + e);
  }
};
/*/NON-ESP*/