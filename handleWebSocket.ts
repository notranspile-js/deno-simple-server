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

async function handleSock(
  logger: SimpleLogger,
  conf: WebSocketConfig,
  sock: WebSocket,
) {
  for await (const ev of sock) {
    if (conf.handler) {
      await callHandler(logger, conf.handler, sock, ev);
    }
    if (isWebSocketCloseEvent(ev)) {
      break;
    }
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
    await handleSock(logger, conf, sock);
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
  logger: SimpleLogger,
  conf: WebSocketConfig,
  active: Set<WebSocket>,
  req: ServerRequest,
) => {
  try {
    const { conn, r: bufReader, w: bufWriter, headers } = req;
    const sock = await acceptWebSocket({
      conn,
      bufReader,
      bufWriter,
      headers,
    });
    handleSockNothrow(logger, conf, active, sock);
  } catch (e) {
    respond500(logger, req, e);
  }
};
