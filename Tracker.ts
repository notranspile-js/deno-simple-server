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

import SimpleRequest from "./SimpleRequest.ts";
import LoggerWrapper from "./LoggerWrapper.ts";

type TrackedHttpRequest = {
  req: SimpleRequest,
  reqOp: Promise<void>
}

type TrackedConn = {
  tcpConn: Deno.Conn,
  httpConn: Deno.HttpConn,
  httpConnOp: Promise<void>
  activeRequests: Map<number, TrackedHttpRequest>
}

type TrackedListener = {
  listener: Deno.Listener,
  listenerOp: Promise<void>
  conns: Map<number, TrackedConn>,
}

export default class Tracker {
  logger: LoggerWrapper;
  trackedListener: TrackedListener;

  constructor(logger: LoggerWrapper, listener: Deno.Listener, listenerOp: Promise<void>) {
    this.logger = logger;
    this.trackedListener = {
      listener,
      listenerOp: listenerOp,
      conns: new Map<number, TrackedConn>(),
    }
  }

  trackConn(tcpConn: Deno.Conn, httpConn: Deno.HttpConn, httpConnOp: Promise<void>): void {
    this.trackedListener.conns.set(httpConn.rid, {
      tcpConn,
      httpConn,
      httpConnOp: httpConnOp,
      activeRequests: new Map<number, TrackedHttpRequest>()
    });
  }

  trackRequest(req: SimpleRequest, reqOp: Promise<void>): void {
    const tc = this._getTC(req.conn);
    tc.activeRequests.set(req.id, {
      req,
      reqOp
    })
  }

  async untrackRequest(req: SimpleRequest): Promise<void> {
    const tc = this._getTC(req.conn);
    const tr = tc.activeRequests.get(req.id);
    if (!tr) {
      throw new Error(`Invalid untracked HTTP request, id: [${req.id}]`);
    }
    await tr.reqOp;
    tc.activeRequests.delete(req.id);
  }

  async untrackConn(httpConn: Deno.HttpConn): Promise<void> {
    const tc = this._getTC(httpConn);
    this._closeTC(tc);
    await this._awaitTC(tc);
  }

  async close(): Promise<void> {
    const tcs = Array.from(this.trackedListener.conns.values());
    const ops = tcs.map((tc) => {
      return this._awaitTC(tc);
    });
    for (const tc of tcs) {
      this._closeTC(tc);
    }
    this._closeNoThrow(this.trackedListener.listener);
    await Promise.allSettled(ops);
    await this.trackedListener.listenerOp;
  }

  _getTC(httpConn: Deno.HttpConn): TrackedConn {
    const tc = this.trackedListener.conns.get(httpConn.rid);
    if (!tc) {
      throw new Error(`Invalid untracked HTTP connection, rid: [${httpConn.rid}]`);
    }
    return tc;
  }

  _closeTC(tc: TrackedConn): void {
    this._closeNoThrow(tc.httpConn);
    this._closeNoThrow(tc.tcpConn);
  }

  async _awaitTC(tc: TrackedConn): Promise<void> {
    await Promise.allSettled(tc.activeRequests.values());
    await tc.httpConnOp;
  }

  _closeNoThrow(closer: Deno.Closer): void {
    try {
      closer.close();
    } catch(e) {
      this.logger.error(e);
    }
  }

}