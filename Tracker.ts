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

import { ServerStatus } from "./types.ts";
import SimpleRequest from "./SimpleRequest.ts";
import LoggerWrapper from "./LoggerWrapper.ts";

async function opActive(op: Promise<void>) {
  const dummy = {};
  try {
    const done = await Promise.race([op, dummy]);
    return done == dummy;
  } catch (_) {
    return false;
  }
}

type TrackedHttpRequest = {
  req: SimpleRequest,
  reqOp: Promise<void>
}

type TrackedConn = {
  tcpConn: Deno.Conn,
  tcpConnActive: boolean,
  httpConn: Deno.HttpConn,
  httpConnActive: boolean,
  httpConnOp: Promise<void>
  activeRequests: Map<number, TrackedHttpRequest>
}

type TrackedListener = {
  listener: Deno.Listener,
  listenerActive: boolean,
  listenerOp: Promise<void>
  conns: Map<number, TrackedConn>,
}

export default class Tracker {
  logger: LoggerWrapper;
  trackedListener: TrackedListener;
  closing: boolean;

  constructor(logger: LoggerWrapper, listener: Deno.Listener, listenerOp: Promise<void>) {
    this.logger = logger;
    this.trackedListener = {
      listener,
      listenerActive: true,
      listenerOp: listenerOp,
      conns: new Map<number, TrackedConn>(),
    };
    this.closing = false;
  }

  trackConn(tcpConn: Deno.Conn, httpConn: Deno.HttpConn, httpConnOp: Promise<void>): void {
    if (this.closing) {
      return;
    }
    this.trackedListener.conns.set(httpConn.rid, {
      tcpConn,
      tcpConnActive: true,
      httpConn,
      httpConnActive: true,
      httpConnOp: httpConnOp,
      activeRequests: new Map<number, TrackedHttpRequest>()
    });
  }

  trackRequest(req: SimpleRequest, reqOp: Promise<void>): void {
    if (this.closing) {
      return;
    }
    const tc = this._getTC(req.conn);
    tc.activeRequests.set(req.id, {
      req,
      reqOp
    })
  }

  async untrackRequest(req: SimpleRequest): Promise<void> {
    if (this.closing) {
      return;
    }
    const tc = this._getTC(req.conn);
    await this._untrackTHR(tc.activeRequests, req.id);
  }

  async untrackConn(httpConn: Deno.HttpConn): Promise<void> {
    if (this.closing) {
      return;
    }
    const tc = this._getTC(httpConn);
    this._closeTC(tc);
    this.trackedListener.conns.delete(httpConn.rid);
    await this._awaitTC(tc);
  }

  async close(): Promise<void> {
    if (this.closing) {
      return;
    }
    this.closing = true;
    const tl = this.trackedListener;
    const tcs = Array.from(tl.conns.values());
    const tcOps = tcs.map((tc) => {
      return this._awaitTC(tc);
    });
    const thrOps: Promise<void>[] = [];
    for (const tc of tcs) {
      this._closeTC(tc);
      const ids = Array.from(tc.activeRequests.keys());
      const ops = ids.map((id) => {
        return this._untrackTHR(tc.activeRequests, id);
      }); 
      ops.forEach((op) => {
        thrOps.push(op);
      });
    }
    this._closeNoThrow(tl.listener);
    tl.listenerActive = false;
    await Promise.allSettled(thrOps);
    await Promise.allSettled(tcOps);
    await this.trackedListener.listenerOp;
  }

  async status(): Promise<ServerStatus> {
    const tl = this.trackedListener;
    const listenerActive = tl.listenerActive;
    const listenerOpActive = await opActive(tl.listenerOp);
    let activeTcpConns = 0;
    let activeHttpConns = 0;
    let activeHttpConnOps = 0;
    let activeRequests = 0;
    let activeRequestOps = 0;
    for (const tc of tl.conns.values()) {
      if (tc.tcpConnActive) {
        activeTcpConns += 1;
      }
      if (tc.httpConnActive) {
        activeHttpConns += 1;
      }
      if (await opActive(tc.httpConnOp)) {
        activeHttpConnOps += 1;
      }
      for (const tr of tc.activeRequests.values()) {
        activeRequests += 1;
        if (await opActive(tr.reqOp)) {
          activeRequestOps += 1;
        }
      }
    }
    return {
      listenerActive,
      listenerOpActive,
      activeTcpConns,
      activeHttpConns,
      activeHttpConnOps,
      activeRequests,
      activeRequestOps,
    };
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
    tc.httpConnActive = false;
    this._closeNoThrow(tc.tcpConn);
    tc.tcpConnActive = false;
  }

  async _awaitTC(tc: TrackedConn): Promise<void> {
    await Promise.allSettled(tc.activeRequests.values());
    await tc.httpConnOp;
  }

  async _untrackTHR(map: Map<number, TrackedHttpRequest>, id: number) {
    const tr = map.get(id);
    if (!tr) {
      throw new Error(`Invalid untracked HTTP request, id: [${id}]`);
    }
    map.delete(id);
    await tr.reqOp;
  }

  _closeNoThrow(closer: Deno.Closer): void {
    try {
      closer.close();
    } catch(_) {
      // this.logger.error(e);
    }
  }

}