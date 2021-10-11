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

import closeQuietly from "../closeQuietly.ts";
import SimpleConn from "../SimpleConn.ts";
import SimpleRequest from "../SimpleRequest.ts";
import SimpleServer from "../SimpleServer.ts";
import handleHttp from "../handleHttp.ts";

import { assert, assertEquals } from "./test_deps.ts";

type Msg = {
  foo: number;
  bar?: number;
};

const server: SimpleServer = {
  conf: {
    http: {
      path: "/",
      handler: requestHandler
    },
  },
  logger: {
    info: (/* msg: string */) => {
      // console.log(msg);
    },
    error: (msg: string) => {
      assert(msg.startsWith("Server Error, method: [GET], url: [http://127.0.0.1:8080/failure]"));
    },
  }
} as unknown as SimpleServer;

async function requestHandler(req: SimpleRequest) {
  if ("/success" == req.path) {
    const obj = await req.json<Msg>();
    obj.bar = 43;
    return {
      status: 200,
      json: obj,
    };
  } else if ("/failure" == req.path) {
    throw new Error("Failure Handler");
  } else {
    throw new Error("Test failed.");
  }
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
  const httpConn = Deno.serveHttp(tcpConn);
  activeConns.push(httpConn);
  for await (const ev of httpConn) {
    const req = new SimpleRequest(server, null as unknown as SimpleConn, ev);
    await handleHttp(req);
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

  // cleanup

  for (const hc of activeConns) {
    closeQuietly(hc);
  }
  await Promise.allSettled(httpPromises);
  listener.close();
  await serverPromise;
});
