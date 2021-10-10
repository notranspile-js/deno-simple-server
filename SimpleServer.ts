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

import { ServerConfig, ServerStatus } from "./types.ts";
import LoggerWrapper from "./LoggerWrapper.ts";
import TrackingConn from "./TrackingConn.ts";
import TrackingListener from "./TrackingListener.ts";
import SimpleRequest from "./SimpleRequest.ts";
import handleHttp from "./handleHttp.ts";
import handleFile from "./handleFile.ts";
// import handleWebSocket from "./handleWebSocket.ts";
import respond302 from "./respond302.ts";
import respond404 from "./respond404.ts";
import respond500 from "./respond500.ts";

export default class SimpleServer {
  conf: ServerConfig;
  logger: LoggerWrapper;
  listener: TrackingListener;
  closing: boolean;
  onClose: (() => void)[];

  constructor(conf: ServerConfig) {
    this.conf = conf;
    this.logger = new LoggerWrapper(conf.logger);
    const denoListener = Deno.listen(conf.listen);
    this.listener = new TrackingListener(this.logger, denoListener);

    this.closing = false;
    this.onClose = [];

    const listenerOp = this._spawnListenerOp(this.listener);
    this.listener.trackOp(listenerOp);
  }

  async close(): Promise<void> {
    if (this.closing) {
      return;
    }
    this.closing = true;
    const st = this.status;
    this.logger.info(`Closing server,` +
      ` active connections: [${st.activeConnections}],` +
      ` active requests: [${st.activeRequests}] ...`);
    this.listener.close();
    await this.listener.ensureDone();
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

  get status(): ServerStatus {
    return this.listener.status();
  }

  async _spawnListenerOp(listener: TrackingListener): Promise<void> {
    for (;;) {
      try {
        const tcpConn: Deno.Conn = await listener.denoListener.accept();
        if (!tcpConn) {
          break;
        }
        const httpConn = Deno.serveHttp(tcpConn);
        const conn = new TrackingConn(this.logger, tcpConn, httpConn);
        const connOp = this._spawnConnOp(conn);
        conn.trackOp(connOp);
        listener.trackConn(conn);
      } catch (e) {
        if (this.closing) {
          break;
        }
        this.logger.error(e);
      }
    }
  }

  async _spawnConnOp(conn: TrackingConn): Promise<void> {
    for (;;) {
      try {
        const ev = await conn.httpConn.nextRequest();
        if (!ev) {
          break;
        }
        const req = new SimpleRequest(this, ev);
        const reqOp = this._spawnReqOp(conn, req);
        req.trackOp(reqOp);
        conn.trackRequest(req);
      } catch (e) {
        if (this.closing) {
          break;
        }
        this.logger.error(e);
      }
    }
    this.listener.untrackConn(conn);
  }

  async _spawnReqOp(conn: TrackingConn, req: SimpleRequest): Promise<void> {
    try {
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
    } catch(e) {
      await respond500(this.logger, req.ev, e);
    } finally {
      conn.untrackRequest(req);
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
