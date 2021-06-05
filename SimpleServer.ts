import { serve, Server, serveTLS } from "./deps.ts";

import { ServerConfig } from "./types.ts";
import LoggerWrapper from "./LoggerWrapper.ts";
import handleHttp from "./handleHttp.ts";
import handleFile from "./handleFile.ts";
import respond404 from "./respond404.ts";

export default class SimpleServer {
  conf: ServerConfig;
  logger: LoggerWrapper;
  srv: Server;
  shutdownPromise: Promise<void>;

  constructor(conf: ServerConfig) {
    this.conf = conf;
    this.logger = new LoggerWrapper(conf.logger);
    if ("certFile" in conf.listen) {
      this.srv = serveTLS(conf.listen);
    } else {
      this.srv = serve(conf.listen);
    }

    // receive requests
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
        handleHttp(this.logger, this.conf.http.handler, req);
      } else if (this.conf.files && req.url.startsWith(this.conf.files.path)) {
        handleFile(this.logger, this.conf.files, req);
      } else {
        respond404(this.logger, req);
      }
    }
  }
}
