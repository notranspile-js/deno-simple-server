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
import { SimpleRequest, SimpleServer } from "../mod.ts";

type Msg = {
  foo: number;
  bar?: number;
};

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
          status: 200,
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
  assertEquals(obj, {
    foo: 42,
    bar: 43,
  });
  await server.close();
});

Deno.test("SimpleServer_await_running", async () => {
  const server = new SimpleServer({
    listen: {
      port: 8080,
    }
  });
  let awaited = false;
  setTimeout(() => {
    awaited = true;
    server.close();
  }, 0);
  await server.running;
  assert(awaited);
});