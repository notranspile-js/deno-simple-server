import { assertEquals, readAll } from "./test_deps.ts";

import createServer from "../createServer.ts";
import iterateRequests from "../iterateRequests.ts";

const decoder = new TextDecoder();

Deno.test("simple", async () => {
  const server = createServer({
    port: 8080,
  });
  iterateRequests(server, async (req) => {
    const arr = await readAll(req.body);
    const str = decoder.decode(arr);
    const obj = JSON.parse(str);
    obj.bar = 43;
    return JSON.stringify(obj);
  });
  const resp = await fetch("http://127.0.0.1:8080/", {
    method: "POSt",
    body: JSON.stringify({
      foo: 42,
    }),
  });
  const obj = await resp.json();
  assertEquals(obj, {
    foo: 42,
    bar: 43,
  });
  server.close();
});
