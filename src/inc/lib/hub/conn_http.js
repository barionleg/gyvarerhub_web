class HTTPconn {
  tout_btw = 10;
  tout = 3000;
  discovering = false;

  constructor(hub) {
    this._hub = hub;
  }

  // discover
  discover() {
    if (this.discovering) return;
    for (let i in this._hub.devices) {
      setTimeout(() => {
        let dev = this._hub.devices[i].info;
        if (dev.ip) this.send(dev.id, dev.ip, dev.port, `hub/${dev.prefix}/${dev.id}`);
      }, this.tout_btw * i);
    }
    this._discoverFlag(this.tout_btw * this._hub.devices.length + this.tout);
  }
  discover_ip(ip, port) {
    if (this.discovering) return;
    this.send(null, ip, port, `hub/${this._hub.cfg.prefix}`);
    this._discoverFlag(this.tout);
  }
  discover_all() {
    if (this.discovering) return;
    let ips = getIPs(this._hub.cfg.local_ip, this._hub.cfg.netmask);
    if (!ips) return;

    for (let i in ips) {
      setTimeout(() => {
        this.send(null, ips[i], this._hub.cfg.local_port, `hub/${this._hub.cfg.prefix}`);
      }, this.tout_btw * i);
    }
    this._discoverFlag(this.tout_btw * ips.length + this.tout);
  }

  send(id, ip, port, uri) {
    this.get(`http://${ip}:${port}/${uri}`)
      .then(res => this._hub.parse(Conn.HTTP, res, id, ip, port))
      .catch(e => { });
  }

  _discoverFlag(tout) {
    this.discovering = true;
    setTimeout(() => {
      this.discovering = false;
      this._hub._checkDiscoverEnd();
    }, tout);
  }

  // http
  get(url) {
    return new Promise((res, rej) => {
      try {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
          if (this.readyState == 4) {
            if (this.status == 200) res(this.responseText);
            else rej("Error");
          }
        }
        xhr.ontimeout = () => rej("Timeout");
        xhr.onerror = () => rej("Error");
        xhr.timeout = this.tout;
        xhr.open('GET', url, true);
        xhr.send();
      } catch (e) {
        rej(e);
      }
    });
  }
  fetch(url, onprogress) {
    return new Promise((res, rej) => {
      onprogress(0);
      var xhr = new XMLHttpRequest();
      xhr.onprogress = (e) => {
        onprogress(Math.round(e.loaded * 100 / e.total));
      };
      xhr.onloadend = (e) => {
        if (e.loaded && e.loaded == e.total) res(xhr.response);
        else rej('Error ' + xhr.status);
      }
      xhr.timeout = this.tout;
      xhr.ontimeout = () => rej("Timeout");
      xhr.open('GET', url, true);
      xhr.send();
    });
  }
  post(url, data) {
    return new Promise((res, rej) => {
      let xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (this.readyState == 4) {
          switch (this.status) {
            case 200:
              res();
              break;

            case 503:
              rej('forbidden');
              break;

            default:
              rej("error");
              break;
          }
        }
      }
      xhr.open('POST', url, true);
      xhr.send(data);
    });
  }

  // log
  log(t) {
    log('[HTTP] ' + t);
  }
  err(e) {
    err('[HTTP] ' + e);
  }
};