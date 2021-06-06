import { ServerRequest } from "./deps.ts";

import { HttpConfig, SimpleLogger } from "./types.ts";
import SimpleRequest from "./SimpleRequest.ts";
import SimpleServer from "./SimpleServer.ts";
import respond500 from "./respond500.ts";

export default async (
  server: SimpleServer,
  logger: SimpleLogger,
  conf: HttpConfig,
  req: ServerRequest,
) => {
  try {
    logger.info(`HTTP request received, method: [${req.method}], url: [${req.url}]`);
    const sreq = new SimpleRequest(server, req);
    const resp = await conf.handler(sreq);
    await sreq.respond(resp);
  } catch (e) {
    respond500(logger, req, e);
  }
};
