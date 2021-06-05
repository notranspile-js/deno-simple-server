import { ServerRequest, readAll } from "./deps.ts";
import { JsonValue, SimpleResponse } from "./types.ts";

const decoder = new TextDecoder();

export default class SimpleRequest {
  req: ServerRequest;

  constructor(req: ServerRequest) {
    this.req = req;
  }

  async json<T extends JsonValue>(): Promise<T> {
    const bin = await readAll(this.req.body);
    const str = decoder.decode(bin);
    return JSON.parse(str);
  }

  // forward calls

  get url(): string {
    return this.req.url;
  }

  get method(): string {
    return this.req.method;
  }

  get headers(): Headers {
    return this.req.headers;
  }

  get contentLength(): number | null {
    return this.req.contentLength;
  }

  get body(): Deno.Reader {
    return this.req.body;
  }

  respond(r: SimpleResponse) {
    if (r.json) {
      r.body = JSON.stringify(r.json, null, 4);
      if (!r.headers) {
        r.headers = new Headers();
      }
      r.headers.append("Content-Type", "application/json");
    }
    this.req.respond(r);
  }

}
