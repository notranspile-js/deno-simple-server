import { ServerRequest } from "./deps.ts";

import { FileServer, HttpJsonHandler } from "./types.ts";

const encoder = new TextEncoder();

async function handleHttp(handler: HttpJsonHandler, req: ServerRequest) {
  try {
    const resp = await handler(req);
    await req.respond({
      status: 200,
      body: encoder.encode(resp),
    });
  } catch (e) {
    console.log(e);
    await req.respond({
      status: 500,
      body: encoder.encode(e.message),
    });
  }
}

export default async (server: FileServer, httpJsonHandler: HttpJsonHandler) => {
  for await (const req of server.srv) {
    handleHttp(httpJsonHandler, req);
  }
};
