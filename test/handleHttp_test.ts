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

import { SimpleLogger, SimpleResponse } from "../types.ts";
import SimpleRequest from "../SimpleRequest.ts";
import SimpleServer from "../SimpleServer.ts";
import handleHttp from "../handleHttp.ts";

import { assert, assertEquals } from "./test_deps.ts";

type Msg = {
  foo: number;
  bar?: number;
};

const logger: SimpleLogger = {
  info: (/* msg: string */) => {
    // console.log(msg);
  },
  error: (msg: string) => {
    assert(msg.startsWith("Server Error, method: [GET], url: [http://127.0.0.1:8080/failure]"));
  },
};

async function successHandler(req: SimpleRequest) {
  const obj = await req.json<Msg>();
  obj.bar = 43;
  return {
    status: 200,
    json: obj,
  };
}

function failureHandler(_: SimpleRequest): Promise<SimpleResponse> {
  throw new Error("Failure Handler");
}

const httpPromises: Promise<void>[] = [];
const activeConns: Deno.HttpConn[] = [];

async function handleTcpConn(listener: Deno.Listener): Promise<void> {
  for await (const tcpConn of listener) {
    const pr = handleHttpConn(tcpConn);
    httpPromises.push(pr);
  }
}

async function handleHttpConn(tcpConn: Deno.Conn): Promise<void> {
  const dummy: SimpleServer = null as unknown as SimpleServer;
  const httpConn = Deno.serveHttp(tcpConn);
  activeConns.push(httpConn);
  for await (const ev of httpConn) {
    const path = new URL(ev.request.url).pathname;
    if ("/success" == path) {
      await handleHttp(
        () => {},
        dummy,
        logger,
        { path: "/", handler: successHandler },
        ev,
      );
    } else {
      await handleHttp(
        () => {},
        dummy,
        logger,
        { path: "/", handler: failureHandler },
        ev,
      );
    }
  }
}

Deno.test("handleHttp", async () => {
  const listener = Deno.listen({ port: 8080 });
  const serverPromise = handleTcpConn(listener);

  // success
  {
    const resp = await fetch("http://127.0.0.1:8080/success", {
      method: "POST",
      body: JSON.stringify({
        foo: 42,
      }),
    });
    assertEquals(resp.status, 200);
    assertEquals(resp.headers.get("Content-Type"), "application/json");
    const obj = await resp.json();
    assertEquals(obj, {
      foo: 42,
      bar: 43,
    });
  }

  // failure
  {
    const resp = await fetch("http://127.0.0.1:8080/failure");
    assertEquals(resp.status, 500);
    assertEquals(resp.headers.get("Content-Type"), "application/json");
    const obj = await resp.json();
    assertEquals(obj, {
      error: "500 Server Error",
    });
  }

  for (const hc of activeConns) {
    hc.close();
  }
  await Promise.allSettled(httpPromises);
  listener.close();
  await serverPromise;
});
