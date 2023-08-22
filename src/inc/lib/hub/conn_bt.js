class BTconn {
  onConnChange(state) { }
  getName() { return this.bt.getName(); }

  bt = new BluetoothJS();
  discovering = false;

  constructor(hub) {
    this._hub = hub;
    this.bt.onopen = () => this.onConnChange('open');
    this.bt.onclose = () => this.onConnChange('close');
    this.bt.onerror = (e) => {
      this.err(e);
      this.onConnChange('error');
    }
    this.bt.onmessage = (data) => {
      let dev = this._devbt();
      if (dev) dev.checkPacket(Conn.BT, data);
    }
  }
  discover() {
    if (this.discovering) return;
    let dev = this._devbt();
    if (dev) this.send(dev.info.prefix + '/' + dev.info.id);
    this._discoverFlag();
  }
  discover_all() {
    if (this.discovering) return;
    this.discover();
    this._discoverFlag();
  }
  toggle() {
    if (!this.bt.state()) {
      this.bt.open();
      this.onConnChange('connecting');
    } else this.bt.close();
  }
  send(text) {
    this.bt.send(text);
  }
  _discoverFlag(tout) {
    this.discovering = true;
    setTimeout(() => {
      this.discovering = false;
      this._hub._checkDiscoverEnd();
    }, tout);
  }
  _devbt() {
    for (let dev of this._hub.devices) {
      if (dev.conn == Conn.BT) return dev;
    }
    return null;
  }

  // log
  log(t) {
    this._hub.log('[this.bt] ' + t);
  }
  err(e) {
    this._hub.err('[this.bt] ' + e);
  }
}