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

import SimpleConn from "./SimpleConn.ts";
import { ServerStatus, SimpleLogger } from "./types.ts";
import closeQuietly from "./util/closeQuietly.ts";

export default class TrackingListener implements Deno.Closer {
  logger: SimpleLogger;
  denoListener: Deno.Listener;
  activeConns: Set<SimpleConn>;
  closed: boolean;
  op: Promise<void> | null;

  constructor(logger: SimpleLogger, listener: Deno.Listener) {
    this.logger = logger;
    this.denoListener = listener;
    this.activeConns = new Set<SimpleConn>();
    this.closed = false;
    this.op = null;
  }

  trackOp(op: Promise<void>) {
    this.op = op;
  }

  trackConn(conn: SimpleConn) {
    this.activeConns.add(conn);
  }

  untrackConn(conn: SimpleConn) {
    this.activeConns.delete(conn);
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    for (const conn of this.activeConns) {
      closeQuietly(conn);
    }
    closeQuietly(this.denoListener);
  }

  async ensureDone() {
    const ops = [];
    for (const conn of this.activeConns) {
      ops.push(conn.ensureDone());
    }
    await Promise.allSettled(ops);
    if (null != this.op) {
      try {
        await this.op;
      } catch (e) {
        this.logger.error(String(e));
      }
    }
  }

  status(): ServerStatus {
    const listenerActive = !this.closed;
    const activeConnections = this.activeConns.size;
    let activeWebSockets = 0;
    for (const conn of this.activeConns) {
      if (conn.websocket) {
        activeWebSockets += 1;
      }
    }
    return {
      listenerActive,
      activeConnections,
      activeWebSockets,
    };
  }
}
