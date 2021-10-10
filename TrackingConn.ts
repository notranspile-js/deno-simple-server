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

import closeQuietly from "./closeQuietly.ts";
import SimpleRequest from "./SimpleRequest.ts";
import { SimpleLogger } from "./types.ts";

export default class TrackingConn {
  logger: SimpleLogger;
  tcpConn: Deno.Conn;
  httpConn: Deno.HttpConn;
  activeRequests: Set<SimpleRequest>;
  op: Promise<void> | null;

  constructor(logger: SimpleLogger, tcpConn: Deno.Conn, httpConn: Deno.HttpConn) {
    this.logger = logger;
    this.tcpConn = tcpConn;
    this.httpConn = httpConn;
    this.activeRequests = new Set<SimpleRequest>();
    this.op = null;
  }

  trackOp(op: Promise<void>) {
    this.op = op;
  }

  close(): void {
    closeQuietly(this.httpConn);
    closeQuietly(this.tcpConn);
  }

  async ensureDone(): Promise<void> {
    const reqOps = [];
    for (const req of this.activeRequests) {
      reqOps.push(req.ensureDone());
    }
    await Promise.allSettled(reqOps);
    if (null != this.op) {
      try {
        await this.op;
      } catch(e) {
        this.logger.error(String(e));
      }
    }
  }

  trackRequest(req: SimpleRequest) {
    this.activeRequests.add(req);
  }

  untrackRequest(req: SimpleRequest) {
    this.activeRequests.delete(req);
  }

}