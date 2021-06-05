import { ServerRequest } from "./deps.ts";
import { SimpleLogger } from "./types.ts";

// deno-lint-ignore no-explicit-any
export default async (logger: SimpleLogger, req: ServerRequest, e: any) => {
  const err = e?.stack || String(e);
  const msg =
    `[http] Server Error, method: [${req.method}], url: [${req.url}], error: \n${err}`;
  logger.error(msg);
  const headers = new Headers();
  headers.set("content-type", "application/json");
  try {
    await req.respond({
      status: 500,
      headers,
      body: JSON.stringify(
        {
          error: "500 Server Error",
        },
        null,
        4,
      ),
    });
  } catch (_) {
    // ignore
  }
};
