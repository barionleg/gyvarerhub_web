class WSconn {
  constructor(hub) {
    this._hub = hub;
  }

  start(id) {
    if (!this._hub.cfg.use_local) return;
    let dev = this._hub.dev(id);
    if (!dev || dev.ws || !dev.focused) return;

    dev.ws = new WebSocket(`ws://${dev.info.ip}:${dev.info.ws_port}/`, ['hub']);

    dev.ws.onopen = () => {
      this.log(`${id} opened`);
      if (!dev.focused) dev.ws.close();
    };

    dev.ws.onclose = () => {
      this.log(`${id} closed`);
      dev.ws = null;
      if (dev.focused) setTimeout(() => this.start(id), 500);
    };

    dev.ws.onerror = () => {
      this.err(`${id}`);
    };

    dev.ws.onmessage = (e) => {
      this._hub.parse(Conn.HTTP, e.data, id);
      // no buffer!
    };
  }
  stop(id) {
    let dev = this._hub.dev(id);
    if (!dev.ws || dev.ws.readyState >= 2) return;
    this.log(`${id} close...`);
    dev.ws.close();
  }
  state(id) {
    let dev = this._hub.dev(id);
    return (dev && dev.ws && dev.ws.readyState == 1);
  }
  send(id, text) {
    if (this.state(id)) this._hub.dev(id).ws.send(text.toString() + '\0');
  }

  // log
  log(t) {
    this._hub.log('[WS] ' + t);
  }
  err(e) {
    this._hub.err('[WS] ' + e);
  }
}