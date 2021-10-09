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

/*
import { serve, WebSocket, WebSocketEvent } from "../deps.ts";
import handleWebSocket from "../handleWebSocket.ts";
import type { WebSocketHandler } from "../types.ts";

import { assert, assertEquals } from "./test_deps.ts";

const logger = {
  info: () => {},
  error: () => {},
};

const mirrorHandler: WebSocketHandler = async (
  sock: WebSocket,
  ev: WebSocketEvent,
) => {
  if (typeof ev === "string") {
    await sock.send(ev); // mirror
  }
};

const activeSockets = new Set<WebSocket>();

Deno.test("handleWebSocket", async () => {
  const server = serve({ port: 8080 });
  const serverPromise = (async () => {
    for await (const req of server) {
      await handleWebSocket(
        () => {},
        logger,
        {
          path: "/websocket",
          handler: mirrorHandler,
        },
        activeSockets,
        req,
      );
    }
  })();

  const sock = new WebSocket("ws://localhost:8080/websocket");
  const messages = ["foo", "bar", "baz"];

  sock.addEventListener("open", function () {
    for (const msg of messages) {
      sock.send(msg);
    }
  });

  let idx = 0;
  let resolveClient: (value?: void) => void = () => {};

  const clientPromise = new Promise((resolve) => {
    resolveClient = resolve;
  });

  sock.addEventListener("message", function (ev) {
    assert(idx < messages.length);
    assertEquals(messages[idx], ev.data);
    idx++;
    if (messages.length === idx) {
      resolveClient();
    }
  });

  await clientPromise;
  assertEquals(messages.length, idx);

  sock.close();
  for (const ws of activeSockets) {
    await ws.close();
  }
  server.close();
  // does not resolves for some reason
  // await serverPromise;

});
*/