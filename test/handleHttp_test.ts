import { serve } from "../deps.ts";
import { SimpleResponse } from "../types.ts";
import SimpleRequest from "../SimpleRequest.ts";
import handleHttp from "../handleHttp.ts";

import { assertEquals } from "./test_deps.ts";

type Msg = {
  foo: number;
  bar?: number;
};

const logger = {
  info: () => {},  
  error: () => {}
}

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

Deno.test("HttpHandler", async () => {
  const server = serve({ port: 8080 });
  const serverPromise = (async () => {
    for await (const req of server) {
      if (req.url == "/success") {
        await handleHttp(logger, successHandler, req);
      } else {
        await handleHttp(logger, failureHandler, req);
      }
    }
  })();

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
      error: "500 Server Error"
    });
  }

  server.close();
  await serverPromise;
});
