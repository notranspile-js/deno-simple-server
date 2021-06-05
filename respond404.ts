import { ServerRequest } from "./deps.ts";
import { SimpleLogger } from "./types.ts";

export default async (logger: SimpleLogger, req: ServerRequest) => {
  const msg = `[http] Not Found, method: [${req.method}], url: [${req.url}]`;
  logger.error(msg);
  const headers = new Headers();
  headers.set("content-type", "application/json");
  try {
    await req.respond({
      status: 404,
      headers,
      body: JSON.stringify(
        {
          error: "404 Not Found",
          path: req.url,
        },
        null,
        4,
      ),
    });
  } catch (_) {
    // ignore
  }
};
