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

import { assert, assertEquals } from "./test_deps.ts";
import { ServerStatus, SimpleRequest, SimpleServer } from "../mod.ts";

type Msg = {
  foo: number;
  bar?: number;
};

function assertStatus(status: ServerStatus): void {
  assert(!status.listenerActive, "listenerActive");
  assertEquals(status.activeConnections, 0, "activeConnections");
  assertEquals(status.activeWebSockets, 0, "activeWebSockets");
}

Deno.test("SimpleServer_json", async () => {
  const server = new SimpleServer({
    listen: {
      port: 8080,
    },
    http: {
      path: "/",
      handler: async (req: SimpleRequest) => {
        const obj = await req.json<Msg>();
        obj.bar = 43;
        return {
          json: obj,
        };
      },
    },
  });
  const resp = await fetch("http://127.0.0.1:8080/", {
    method: "POST",
    body: JSON.stringify({
      foo: 42,
    }),
  });
  const obj = await resp.json();
  assertEquals(resp.status, 200);
  assertEquals(obj, {
    foo: 42,
    bar: 43,
  });

  await server.close();
  assertStatus(server.status);
});

Deno.test("SimpleServer_await_done", async () => {
  const server = new SimpleServer({
    listen: {
      port: 8080,
    },
  });
  let awaited = false;
  setTimeout(() => {
    awaited = true;
    server.close();
  });
  await server.done;
  assert(awaited);
  assertStatus(server.status);
});

Deno.test("SimpleServer_slow_handler", async () => {
  let resolveRequestHandled: (() => void) | null = null;
  let resolveRequestReceived: ((value?: null) => void) | null = null;
  const requestReceivedPromise = new Promise((resolve) => {
    resolveRequestReceived = resolve;
  });

  const server = new SimpleServer({
    listen: {
      port: 8080,
    },
    http: {
      path: "/",
      handler: async (_req: SimpleRequest) => {
        resolveRequestReceived!();
        return await new Promise((resolve) => {
          resolveRequestHandled = () => {
            resolve({
              json: {
                foo: 42,
              },
            });
          };
        });
      },
    },
  });

  setTimeout(async () => {
    try {
      const resp = await fetch("http://127.0.0.1:8080/");
      await resp.text();
    } catch (_) {
      // connection closed before message completed
    }
  });
  await requestReceivedPromise;
  const statusBefore = server.status;
  assertEquals(statusBefore.activeConnections, 1);
  resolveRequestHandled!();
  await server.close();
  assertStatus(server.status);
});

Deno.test("SimpleServer_ws_close", async () => {
  let resolveRequestHandled: ((value?: null) => void) | null = null;
  let resolveRequestReceived: ((value?: null) => void) | null = null;
  const requestReceivedPromise = new Promise((resolve) => {
    resolveRequestReceived = resolve;
  });
  const server = new SimpleServer({
    listen: {
      port: 8080,
    },
    websocket: {
      path: "/websocket",
      onmessage: async () => {
        resolveRequestReceived!();
        await new Promise((resolve) => {
          resolveRequestHandled = resolve;
        });
      },
    },
  });

  const sock = new WebSocket("ws://localhost:8080/websocket");
  sock.onopen = () => {
    sock.send("foo");
  };
  await requestReceivedPromise;
  const statusBefore = server.status;
  assertEquals(statusBefore.activeConnections, 1);
  assertEquals(statusBefore.activeWebSockets, 1);
  resolveRequestHandled!();
  await server.close();
  assertStatus(server.status);
  sock.close();
});

Deno.test("SimpleServer_ws_broadcast", async () => {
  const server = new SimpleServer({
    listen: {
      port: 8080,
    },
    http: {
      path: "/broadcast",
      handler: (req: SimpleRequest): Promise<Response> => {
        req.server.broadcastWebsocket({
          foo: 42
        });
        return Promise.resolve(new Response());
      },
    },
    websocket: {
      path: "/websocket"
    },
  });

  let resolveClient: ((value?: null) => void) | null = null;
  const broadcastPromise = new Promise((resolve) => {
    resolveClient = resolve;
  });
  let opened = 0;
  let broadcastReceivedCount = 0;
  const socks: WebSocket[] = [];
  for (let i = 0; i < 3; i++) {
    const sock = new WebSocket("ws://localhost:8080/websocket");
    sock.onopen = async () => {
      opened +=1;
      if (3 == opened) {
        const resp = await fetch("http://127.0.0.1:8080/broadcast");;
        await resp.text();
      }
    };
    sock.onmessage = () => {
      broadcastReceivedCount += 1;
      if (3 == broadcastReceivedCount) {
        resolveClient!();
      }
    };
    socks.push(sock);
  }
  await broadcastPromise;
  for (const sock of socks) {
    sock.close();
  }
  await server.close();
  assertStatus(server.status);
});
