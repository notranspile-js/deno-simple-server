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
import { SimpleRequest, SimpleServer, ServerStatus } from "../mod.ts";

type Msg = {
  foo: number;
  bar?: number;
};

function assertStatus(status: ServerStatus): void {
  assert(!status.listenerActive, "listenerActive");
  assert(!status.listenerOpActive, "listenerOpActive");
  assertEquals(status.activeTcpConns, 0, "activeTcpConns");
  assertEquals(status.activeHttpConns, 0, "activeHttpConns");
  assertEquals(status.activeHttpConnOps, 0, "activeHttpConnOps");
  assertEquals(status.activeRequests, 0, "activeRequests");
  assertEquals(status.activeRequestOps, 0, "activeRequestOps");
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
  assertStatus(await server.status());
});

Deno.test("SimpleServer_await_done", async () => {
  const server = new SimpleServer({
    listen: {
      port: 8080,
    }
  });
  let awaited = false;
  setTimeout(() => {
    awaited = true;
    server.close();
  });
  await server.done;
  assert(awaited);
  assertStatus(await server.status());
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
                foo: 42
              },
            });
          }
        });
      },
    },
  });

  setTimeout(async () => {
    try {
      const resp = await fetch("http://127.0.0.1:8080/");
      await resp.text();
    } catch(_) {
      // connection closed before message completed
    }
  })
  await requestReceivedPromise;
  const statusBefore = await server.status();
  assertEquals(statusBefore.activeRequestOps, 1);
  resolveRequestHandled!();
  await server.close();
  assertStatus(await server.status());
});