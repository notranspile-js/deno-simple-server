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
import { SimpleLogger, WebSocketConfig } from "./types.ts";
import respond400 from "./respond400.ts";
import respond500 from "./respond500.ts";

async function handleSockNoThrow(
  logger: SimpleLogger,
  conf: WebSocketConfig,
  sock: WebSocket,
  id: number,
) {
  let activeOpsCount = 0;
  let closing = false;

  try {
    await new Promise((resolve) => {
      const callWithOpCountNoThrow = async (
        // deno-lint-ignore no-explicit-any
        fun: any,
        cb: () => Promise<void>,
      ) => {
        if (fun && !closing) {
          activeOpsCount += 1;
          try {
            await cb();
          } catch (e) {
            logger.error(String(e));
          }
          activeOpsCount -= 1;
        }
        if (closing && 0 == activeOpsCount) {
          resolve(null);
        }
      };

      sock.onopen = async (ev: Event) => {
        await callWithOpCountNoThrow(conf.onopen, async () => {
          await conf.onopen!(sock, ev);
        });
      };
      sock.onmessage = async (ev: MessageEvent) => {
        await callWithOpCountNoThrow(conf.onmessage, async () => {
          await conf.onmessage!(sock, ev);
        });
      };
      sock.onerror = async (ev: Event | ErrorEvent) => {
        await callWithOpCountNoThrow(conf.onerror, async () => {
          await conf.onerror!(sock, ev);
        });
      };
      sock.onclose = async (ev: CloseEvent) => {
        await callWithOpCountNoThrow(conf.onclose, async () => {
          await conf.onclose!(sock, ev);
        });
        logger.info(
          `WebSocket close message received, id: [${id}],` +
          ` activeOpsCount: [${activeOpsCount}]`,
        );
        closing = true;
        if (0 == activeOpsCount) {
          resolve(null);
        }
      };
    });
  } catch (e) {
    logger.error(String(e));
  }
}

export default async (
  req: SimpleRequest,
) => {
  const logger = req.server.logger;
  const conf = req.server.conf.websocket!;
  const conn = req.conn;
  let sock: WebSocket | null = null;
  try {
    if ("websocket" != req.headers.get("upgrade")) {
      await respond400(logger, req.ev);
      return;
    }
    const upg = Deno.upgradeWebSocket(req.ev.request);
    await req.ev.respondWith(upg.response);
    sock = upg.socket;
  } catch (e) {
    await respond500(logger, req.ev, e);
    return;
  }
  if (null != sock) {
    conn.trackWebSocket(sock);
    logger.info(`WebSocket connection opened, id: [${conn.httpConn.rid}]`);
    await handleSockNoThrow(logger, conf, sock, conn.httpConn.rid);
    closeQuietly(sock);
    logger.info(`WebSocket connection closed, id: [${conn.httpConn.rid}]`);
  }
};
