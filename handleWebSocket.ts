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

import {
  acceptWebSocket,
  isWebSocketCloseEvent,
  ServerRequest,
  WebSocket,
  WebSocketEvent,
} from "./deps.ts";

import { SimpleLogger, WebSocketConfig, WebSocketHandler } from "./types.ts";
import respond500 from "./respond500.ts";

async function callHandler(
  logger: SimpleLogger,
  handler: WebSocketHandler,
  sock: WebSocket,
  ev: WebSocketEvent,
) {
  try {
    await handler(sock, ev);
  } catch (e) {
    const err = e?.stack || String(e);
    logger.error(`WebSocket handler error: error: \n${err}`);
    throw e;
  }
}

async function handleSockNothrow(
  logger: SimpleLogger,
  conf: WebSocketConfig,
  active: Set<WebSocket>,
  sock: WebSocket,
) {
  try {
    active.add(sock);
    logger.info(`WebSocket connection opened, id: [${sock.conn.rid}]`);
    for await (const ev of sock) {
      if (conf.handler) {
        await callHandler(logger, conf.handler, sock, ev);
      }
      if (isWebSocketCloseEvent(ev)) {
        break;
      }
    }
  } catch (_) {
    // ignore
  } finally {
    active.delete(sock);
    logger.info(`WebSocket connection closed, id: [${sock.conn.rid}]`);
    if (!sock.isClosed) {
      try {
        await sock.close();
      } catch (_) {
        // ignore
      }
    }
  }
}

export default async (
  untrack: () => void,
  logger: SimpleLogger,
  conf: WebSocketConfig,
  active: Set<WebSocket>,
  req: ServerRequest,
) => {
  const { conn, r: bufReader, w: bufWriter, headers } = req;
  let sock = null;
  try {
    sock = await acceptWebSocket({
      conn,
      bufReader,
      bufWriter,
      headers,
    });
  } catch (e) {
    respond500(logger, req, e);
  }
  try {
    if (null != sock) {
      await handleSockNothrow(logger, conf, active, sock);
    }
  } finally {
    untrack();
  }
};
