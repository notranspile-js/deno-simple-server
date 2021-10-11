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

import handleWebSocket from "../src/handleWebSocket.ts";
import SimpleConn from "../src/SimpleConn.ts";
import SimpleRequest from "../src/SimpleRequest.ts";
import SimpleServer from "../src/SimpleServer.ts";
import closeQuietly from "../src/util/closeQuietly.ts";

import { assert, assertEquals } from "./test_deps.ts";

// deno-lint-ignore no-explicit-any
let resolveClientAwaits: ((value?: any) => void) | null = null;
// deno-lint-ignore no-explicit-any
let resolveServerAwaits: ((value?: any) => void) | null = null;

const server: SimpleServer = {
  conf: {
    websocket: {
      path: "/websocket",
      onmessage: async (sock: WebSocket, ev: MessageEvent) => {
        if ("await" == ev.data) {
          resolveClientAwaits!();
          await new Promise((resolve) => {
            resolveServerAwaits = resolve;
          });
        } else {
          sock.send(ev.data);
        }
      },
    },
  },
  logger: {
    info: (_msg: string) => {
      // console.log(msg);
    },
    error: (_msg: string) => {
      // console.log(msg);
    },
  },
} as unknown as SimpleServer;

const httpPromises: Promise<void>[] = [];
const activeConns: SimpleConn[] = [];

async function handleTcpConn(listener: Deno.Listener): Promise<void> {
  for await (const tcpConn of listener) {
    const pr = handleHttpConn(tcpConn);
    httpPromises.push(pr);
  }
}

async function handleHttpConn(tcpConn: Deno.Conn): Promise<void> {
  const httpConn = Deno.serveHttp(tcpConn);
  const sconn = new SimpleConn(server.logger, tcpConn, httpConn);
  activeConns.push(sconn);
  for await (const ev of httpConn) {
    const req = new SimpleRequest(server, sconn, ev);
    await handleWebSocket(req);
  }
}

Deno.test("handleWebSocket", async () => {
  const listener = Deno.listen({ port: 8080 });
  const serverPromise = handleTcpConn(listener);

  const sock = new WebSocket("ws://localhost:8080/websocket");
  const messages = ["foo", "bar", "baz"];

  sock.onopen = function () {
    for (const msg of messages) {
      sock.send(msg);
    }
  };

  let idx = 0;
  let resolveClient: (value?: void) => void = () => {};

  const clientPromise = new Promise((resolve) => {
    resolveClient = resolve;
  });

  sock.onmessage = (ev) => {
    assert(idx < messages.length);
    assertEquals(messages[idx], ev.data);
    idx++;
    if (messages.length === idx) {
      resolveClient();
    }
  };

  await clientPromise;
  assertEquals(messages.length, idx);

  // await
  const pr = new Promise((resolve) => {
    resolveClientAwaits = resolve;
  });
  sock.send("await");
  await pr;
  let activeServerSocksCount = 0;
  for (const sc of activeConns) {
    if (null != sc.websocket) {
      activeServerSocksCount += 1;
    }
  }
  assertEquals(activeServerSocksCount, 1);
  resolveServerAwaits!();

  // cleanup

  sock.close();
  for (const hc of activeConns) {
    closeQuietly(hc);
  }
  await Promise.allSettled(httpPromises);
  listener.close();
  await serverPromise;
});
