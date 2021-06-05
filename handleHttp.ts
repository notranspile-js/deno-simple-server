import { ServerRequest } from "./deps.ts";

import { HttpHandler, SimpleLogger } from "./types.ts";
import SimpleRequest from "./SimpleRequest.ts";

export default async (logger: SimpleLogger, handler: HttpHandler, req: ServerRequest) => {
  try {
    logger.info(`[http] request, method: [${req.method}], url: [${req.url}]`);
    const sreq = new SimpleRequest(req);
    const resp = await handler(sreq);
    await sreq.respond(resp);
  } catch (e) {
    const err = e?.stack || String(e); 
    logger.error(err);
    await req.respond({
      status: 500,
      headers: new Headers({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        error: "500 Server Error"
      }, null, 4)
    });
  }
};