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

import { JsonValue, ServerConfig } from "./types.ts";
import LoggerWrapper from "./LoggerWrapper.ts";
import handleHttp from "./handleHttp.ts";
import handleFile from "./handleFile.ts";
// import handleWebSocket from "./handleWebSocket.ts";
import respond302 from "./respond302.ts";
import respond404 from "./respond404.ts";

export default class SimpleServer {
  conf: ServerConfig;
  logger: LoggerWrapper;
  srv: Deno.Listener;
  activeHandlers: Map<number, Promise<void>>;
  activeWebSockets: Set<WebSocket>;
  counter: number;
  closing: boolean;
  closeListeners: (() => void)[];

  constructor(conf: ServerConfig) {
    this.conf = conf;
    this.logger = new LoggerWrapper(conf.logger);
    // if ("certFile" in conf.listen) {
      // todo
      // this.srv = Deno.listenTls(conf.listen);
    // } else {
      this.srv = Deno.listen(conf.listen);
    // }
    this.activeHandlers = new Map();
    this.activeWebSockets = new Set();
    this.counter = 0;
    this.closing = false;
    this.closeListeners = [];

    // receive requests, cannot be waited upon
    this._iterateRequests();
  }

  async close(): Promise<void> {
    this.logger.info("Closing server ...");
    this.closing = true;
    this.srv.close();
    await this._cleanup();
    this.logger.info("Server closed");
  }

  get running(): Promise<void> {
    return new Promise((resolve) => {
      this.closeListeners.push(resolve);
    });
  }

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
            /*
            const pr = handleWebSocket(
              untrack,
              this.logger,
              this.conf.websocket,
              this.activeWebSockets,
              ev,
            );
            this.activeHandlers.set(id, pr);
            */
          } else if ("/" === path && this.conf.rootRedirectLocation) {
            respond302(this.logger, ev, this.conf.rootRedirectLocation);
          } else {
            respond404(this.logger, ev);
          }
        }
      })();
    }
  }

  async _cleanup() {
    const promises = [];
    // for (const ws of this.activeWebSockets) {
      // const pr = this._closeWebSocket(ws);
      // promises.push(pr)
    // }
    for (const [_, pr] of this.activeHandlers.entries()) {
      promises.push(pr);
    }
    // await
    try {
      await Promise.allSettled(promises);
    } catch (e) {
      this.logger.error(e);
    }
    for (const resolve of this.closeListeners) {
      resolve();
    }
  }

  _createUntracker() {
    const id = this.counter++;
    const activeHandlers = this.activeHandlers;
    const untrack = () => {
      activeHandlers.delete(id);
    };
    return { id, untrack };
  }

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
