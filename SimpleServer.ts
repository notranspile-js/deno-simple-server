/*
 * Copyright 2021, alex at staticlibs.net
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ServerConfig } from "./types.ts";
import LoggerWrapper from "./LoggerWrapper.ts";
import SimpleRequest from "./SimpleRequest.ts";
import Tracker from "./Tracker.ts";
import handleHttp from "./handleHttp.ts";
import handleFile from "./handleFile.ts";
// import handleWebSocket from "./handleWebSocket.ts";
import respond302 from "./respond302.ts";
import respond404 from "./respond404.ts";

export default class SimpleServer {
  conf: ServerConfig;
  logger: LoggerWrapper;
  tracker: Tracker;
  counter: number;
  onClose: (() => void)[];

  constructor(conf: ServerConfig) {
    this.conf = conf;
    this.logger = new LoggerWrapper(conf.logger);

    const listener = Deno.listen(conf.listen);
    const listenerOp = this._iterateConns(listener);

    this.tracker = new Tracker(this.logger, listener, listenerOp);
    this.counter = 0;
    this.onClose = [];
  }

  async close(): Promise<void> {
    this.logger.info("Closing server ...");
    await this.tracker.close();
    for (const fun of this.onClose) {
      try {
          fun();
      } catch(e) {
        this.logger.error(e);
      }
    }
    this.logger.info("Server closed");
  }

  get done(): Promise<void> {
    return new Promise((resolve) => {
      this.onClose.push(resolve);
    });
  }

  async _iterateConns(listener: Deno.Listener): Promise<void> {
    for (;;) {
      try {
        const tcpConn: Deno.Conn = await listener.accept();
        if (!tcpConn) {
          break;
        }
        const httpConn = Deno.serveHttp(tcpConn);
        const httpConnOp = this._iterateRequests(httpConn);
        this.tracker.trackConn(tcpConn, httpConn, httpConnOp);
      } catch (e) {
        this.logger.error(e);
      }
    }
  }

  async _iterateRequests(httpConn: Deno.HttpConn): Promise<void> {
    for (;;) {
      try {
        const ev = await httpConn.nextRequest();
        if (!ev) {
          await this.tracker.untrackConn(httpConn);
          break;
        }
        const req = new SimpleRequest(this._generateId(), this, httpConn, ev);
        const reqOp = this._handleRequest(req);
        this.tracker.trackRequest(req, reqOp);
      } catch (e) {
        this.logger.error(e);
      }
    }
  }

  async _handleRequest(req: SimpleRequest): Promise<void> {
    if (this.conf.http && req.path.startsWith(this.conf.http.path)) {
      await handleHttp(req);
    } else if (this.conf.files && req.path.startsWith(this.conf.files.path)) {
      await handleFile(req);
      // this.activeHandlers.set(id, pr);
      // } else if (this.conf.websocket && url === this.conf.websocket.path) {
      // const pr = handleWebSocket(
      // untrack,
      // this.logger,
      // this.conf.websocket,
      // this.activeWebSockets,
      // ev,
      // );
      // this.activeHandlers.set(id, pr);
    } else if ("/" === req.path && this.conf.rootRedirectLocation) {
      await respond302(this.logger, req.ev, this.conf.rootRedirectLocation);
    } else {
      await respond404(this.logger, req.ev);
    }
  }
  
  _generateId() {
    const id = this.counter++;
    if (id < Number.MAX_SAFE_INTEGER) {
      return id;
    } else {
      this.counter = 2;
      return 1;
    }
  }


  /*
  async broadcastWebsocket(
    msg: string | { [key: string]: JsonValue } | JsonValue[],
  ) {
    if (this.closing) {
      return;
    }
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
    } catch (_) {
      // ignore
    }
  }
  */

  /*
  async _iterateRequests() {
    for await (const tcpConn of this.srv) {
      (async () => {
        const httpConn = Deno.serveHttp(tcpConn);
        for await (const ev of httpConn) {
          const { id, untrack } = this._createUntracker();
          const path = new URL(ev.request.url).pathname;
          if (this.conf.http && path.startsWith(this.conf.http.path)) {
            const pr = handleHttp(untrack, this, this.logger, this.conf.http, ev);
            this.activeHandlers.set(id, pr);
          } else if (this.conf.files && path.startsWith(this.conf.files.path)) {
            const pr = handleFile(untrack, this.logger, this.conf.files, ev);
            this.activeHandlers.set(id, pr);
          // } else if (this.conf.websocket && url === this.conf.websocket.path) {
            const pr = handleWebSocket(
              untrack,
              this.logger,
              this.conf.websocket,
              this.activeWebSockets,
              ev,
            );
            this.activeHandlers.set(id, pr);
          } else if ("/" === path && this.conf.rootRedirectLocation) {
            respond302(this.logger, ev, this.conf.rootRedirectLocation);
          } else {
            respond404(this.logger, ev);
          }
        }
      })();
    }
  }
  */

  /*
  _createUntracker() {
    const id = this.counter++;
    const activeHandlers = this.activeHandlers;
    const untrack = () => {
      activeHandlers.delete(id);
    };
    return { id, untrack };
  }
  */

  /*
  async _closeWebSocket(sock: WebSocket): Promise<void> {
    try {
      if (!sock.isClosed) {
        await sock.close();
      }
    } catch(e) {
      this.logger.error(e);
    }
  }
  */
}
