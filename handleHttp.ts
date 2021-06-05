
import { ServerRequest } from "./deps.ts";

import { HttpHandler } from "./types.ts";

const encoder = new TextEncoder();

export default async (handler: HttpHandler, req: ServerRequest) => {
  try {
    const resp = await handler(req);
    await req.respond(resp);
  } catch (e) {
    // todo: fallback
    console.log(e);
    await req.respond({
      status: 500,
      body: encoder.encode(e.message),
    });
  }
}