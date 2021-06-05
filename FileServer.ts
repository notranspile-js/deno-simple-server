import { serve, Server, serveTLS } from "./deps.ts";

import { ServerConfig } from "./types.ts";
import handleHttp from "./handleHttp.ts";

export default class FileServer {
  conf: ServerConfig;
  srv: Server;
  shutdownPromise: Promise<void>;

  constructor(conf: ServerConfig) {
    this.conf = conf;
    if ("certFile" in conf.listen) {
      this.srv = serveTLS(conf.listen);
    } else {
      this.srv = serve(conf.listen);
    }

    this.shutdownPromise = this._iterateRequests();
  }

  async close() {
    this.srv.close();
    await this.shutdownPromise;
  }

  async broadcastWebsocket(/* msg: string */) {
    // todo
  }

  async _iterateRequests() {
    for await (const req of this.srv) {
      if (this.conf.http && req.url.startsWith(this.conf.http.path)) {
        handleHttp(this.conf.http.handler, req);
      }
    }
  }
}
