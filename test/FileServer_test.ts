
import { assertEquals, readAll } from "./test_deps.ts";

import FileServer from "../FileServer.ts";

const decoder = new TextDecoder();

Deno.test("simple", async () => {
  const server = new FileServer({
    listen: {
      port: 8080
    },
    http: {
      path: "/",
      handler: async (req) => {
        const arr = await readAll(req.body);
        const str = decoder.decode(arr);
        const obj = JSON.parse(str);
        obj.bar = 43;
        return {
          status: 200,
          body: JSON.stringify(obj)
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