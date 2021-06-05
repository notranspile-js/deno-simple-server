
import { assertEquals } from "./test_deps.ts";

import SimpleRequest from "../SimpleRequest.ts";
import SimpleServer from "../SimpleServer.ts";

type Msg = {
  foo: number,
  bar?: number
};

Deno.test("SimpleServer", async () => {
  const server = new SimpleServer({
    listen: {
      port: 8080
    },
    http: {
      path: "/",
      handler: async (req: SimpleRequest) => {
        const obj = await req.json<Msg>();
        obj.bar = 43;
        return {
          status: 200,
          json: obj
        };
      }
    }
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