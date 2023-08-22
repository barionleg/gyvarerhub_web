/*NON-ESP*/
class SerialJS {
  async onmessage(data) { }
  async onopen() { }
  async onclose() { }
  async onerror(e) { }
  async onchange(s) { }

  async select() {
    await this.close();
    const ports = await navigator.serial.getPorts();
    for (let port of ports) await port.forget();
    try {
      await navigator.serial.requestPort();
      await this.onchange(true);
    } catch (e) {
      this._onerror(e);
      await this.onchange(false);
    }
  }
  async start(baud) {
    try {
      if (this._port) throw "Already open";
      const ports = await navigator.serial.getPorts();
      if (!ports.length) throw "No port";
      this._port = ports[0];
      try {
        await this._port.open({ baudRate: baud });
        this.onopen();
        await this._readLoop();
      } finally {
        await this._port.close();
        this._port = null;
        this.onclose();
      }
    } catch (e) {
      this._onerror(e);
    }
  }
  async close() {
    this._closing = true;
    if (this._reader) await this._reader.cancel();
  }
  async send(text) {
    if (!this._port) return this._onerror("Not open");
    try {
      const encoder = new TextEncoder();
      const writer = this._port.writable.getWriter();
      await writer.write(encoder.encode(text));
      writer.releaseLock();
    } catch (e) {
      this._onerror(e);
    }
  }

  // private
  _port = null;
  _reader = null;
  _closing = false;

  async _start(baud) {
    if (this._port) throw "Already open";
    const ports = await navigator.serial.getPorts();
    if (!ports.length) throw "No port";
    this._port = ports[0];
    await this._port.open({ baudRate: baud });
    try {
      this.onopen();
      await this._readLoop();
    } finally {
      await this._port.close();
      this._port = null;
      this.onclose();
    }
  }
  async _readLoop() {
    this._closing = false;
    while (this._port.readable && !this._closing) {
      this._reader = this._port.readable.getReader();
      try {
        while (true) {
          const read = await this._reader.read();
          if (read.done) break;
          const data = new TextDecoder().decode(read.value);
          this.onmessage(data);
        }
      } finally {
        this._reader.releaseLock();
        this._reader = null;
      }
    }
  }
  _onerror(e) {
    this.onerror('[Serial] ' + e);
  }
}
/*/NON-ESP*/