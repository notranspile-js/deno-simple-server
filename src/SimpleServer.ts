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

import handleFile from "./handleFile.ts";
import handleHttp from "./handleHttp.ts";
import handleWebSocket from "./handleWebSocket.ts";
import LoggerWrapper from "./LoggerWrapper.ts";
import SimpleConn from "./SimpleConn.ts";
import SimpleListener from "./SimpleListener.ts";
import SimpleRequest from "./SimpleRequest.ts";
import { JsonValue, ServerConfig, ServerStatus } from "./types.ts";
import respond302 from "./responses/respond302.ts";
import respond404 from "./responses/respond404.ts";
import respond500 from "./responses/respond500.ts";
import closeQuietly from "./util/closeQuietly.ts";

export default class SimpleServer {
  conf: ServerConfig;
  logger: LoggerWrapper;
  listener: SimpleListener;
  closing: boolean;
  onClose: (() => void)[];

  constructor(conf: ServerConfig) {
    this.conf = conf;
    this.logger = new LoggerWrapper(conf.logger);
    const denoListener = "certFile" in conf.listen ?
      Deno.listenTls(conf.listen) : Deno.listen(conf.listen);
    this.listener = new SimpleListener(this.logger, denoListener);

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
    this.logger.info(
      `Closing server, active connections: [${st.activeConnections}]`,
    );
    this.listener.close();
    await this.listener.ensureDone();
    for (const fun of this.onClose) {
      try {
        fun();
      } catch (e) {
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

  async _spawnListenerOp(listener: SimpleListener): Promise<void> {
    for (;;) {
      try {
        const tcpConn: Deno.Conn = await listener.denoListener.accept();
        if (!tcpConn) {
          break;
        }
        const httpConn = Deno.serveHttp(tcpConn);
        const conn = new SimpleConn(this.logger, tcpConn, httpConn);
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

  async _spawnConnOp(conn: SimpleConn): Promise<void> {
    for (;;) {
      try {
        const ev = await conn.httpConn.nextRequest();
        if (!ev) {
          break;
        }
        const req = new SimpleRequest(this, conn, ev);
        if (this.conf.websocket && req.path === this.conf.websocket.path) {
          await handleWebSocket(req);
          break;
        }
        await this._handleReq(req);
      } catch (e) {
        if (!this.closing) {
          this.logger.error(e);
        }
        break;
      }
    }
    this.listener.untrackConn(conn);
    closeQuietly(conn);
  }

  async _handleReq(req: SimpleRequest): Promise<void> {
    try {
      if (this.conf.http && req.path.startsWith(this.conf.http.path)) {
        await handleHttp(req);
      } else if (this.conf.files && req.path.startsWith(this.conf.files.path)) {
        await handleFile(req);
      } else if ("/" === req.path && this.conf.rootRedirectLocation) {
        await respond302(this.logger, req.ev, this.conf.rootRedirectLocation);
      } else {
        await respond404(this.logger, req.ev);
      }
    } catch (e) {
      await respond500(this.logger, req.ev, e);
    }
  }

  broadcastWebsocket(
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
    for (const conn of this.listener.activeConns) {
      if (null != conn.websocket) {
        conn.websocket.send(st);
      }
    }
  }
}
