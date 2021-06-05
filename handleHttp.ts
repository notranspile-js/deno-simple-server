import { ServerRequest } from "./deps.ts";

import { HttpHandler, SimpleLogger } from "./types.ts";
import SimpleRequest from "./SimpleRequest.ts";
import respond500 from "./respond500.ts";

export default async (
  logger: SimpleLogger,
  handler: HttpHandler,
  req: ServerRequest,
) => {
  try {
    logger.info(`[http] request, method: [${req.method}], url: [${req.url}]`);
    const sreq = new SimpleRequest(req);
    const resp = await handler(sreq);
    await sreq.respond(resp);
  } catch (e) {
    respond500(logger, req, e);
  }
};
