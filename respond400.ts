import { ServerRequest } from "./deps.ts";
import { SimpleLogger } from "./types.ts";

export default async (logger: SimpleLogger, req: ServerRequest) => {
  const msg = `Bad Request, method: [${req.method}], url: [${req.url}]`;
  logger.error(msg);
  const headers = new Headers();
  headers.set("content-type", "application/json");
  try {
    await req.respond({
      status: 400,
      headers,
      body: JSON.stringify(
        {
          error: "400 Bad Request",
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
