import { serve, Server, serveTLS, WebSocket } from "./deps.ts";

import { JsonValue, ServerConfig } from "./types.ts";
import LoggerWrapper from "./LoggerWrapper.ts";
import handleHttp from "./handleHttp.ts";
import handleFile from "./handleFile.ts";
import handleWebSocket from "./handleWebSocket.ts";
import respond404 from "./respond404.ts";

export default class SimpleServer {
  conf: ServerConfig;
  logger: LoggerWrapper;
  srv: Server;
  activeWebSockets: Set<WebSocket>;
  done: Promise<void>;

  constructor(conf: ServerConfig) {
    this.conf = conf;
    this.logger = new LoggerWrapper(conf.logger);
    if ("certFile" in conf.listen) {
      this.srv = serveTLS(conf.listen);
    } else {
      this.srv = serve(conf.listen);
    }
    this.activeWebSockets = new Set();

    // receive requests
    this.done = this._iterateRequests();
  }

  async close(): Promise<void> {
    this.srv.close();
    await this.done;
  }

  async broadcastWebsocket(msg: string | { [key: string]: JsonValue } | JsonValue[]) {
    let st = "";
    if ("string" !== typeof msg) {
      st = JSON.stringify(msg, null, 4);
    } else {
      st = String(msg);
    }
    const promises = [];
    for (const ws of this.activeWebSockets) {
      const pr = ws.send(st);
      promises.push(pr);
    }
    try {
      await Promise.allSettled(promises);
    } catch(_) {
      // ignore
    }
  }

  async _iterateRequests() {
    for await (const req of this.srv) {
      if (this.conf.http && req.url.startsWith(this.conf.http.path)) {
        handleHttp(this, this.logger, this.conf.http, req);
      } else if (this.conf.files && req.url.startsWith(this.conf.files.path)) {
        handleFile(this.logger, this.conf.files, req);
      } else if (this.conf.websocket && req.url === this.conf.websocket.path) {
        handleWebSocket(this.logger, this.conf.websocket, this.activeWebSockets, req);
      } else {
        respond404(this.logger, req);
      }
    }
  }
}
