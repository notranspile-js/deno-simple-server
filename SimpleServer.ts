import { serve, Server, serveTLS } from "./deps.ts";

import { SimpleLogger, ServerConfig } from "./types.ts";
import handleHttp from "./handleHttp.ts";

class Logger {
  sl?: SimpleLogger;

  constructor(sl?: SimpleLogger) {
    this.sl = sl;
  }

  info(msg: string) {
    if (this.sl?.info) {
      this.sl.info(msg);
    }
  }

  error(msg: string) {
    if (this.sl?.error) {
      this.sl.error(msg);
    }
  }
}

export default class SimpleServer {
  conf: ServerConfig;
  logger: Logger;
  srv: Server;
  shutdownPromise: Promise<void>;

  constructor(conf: ServerConfig) {
    this.conf = conf;
    this.logger = new Logger(conf.logger);
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
        handleHttp(this.logger, this.conf.http.handler, req);
      }
    }
  }
}
