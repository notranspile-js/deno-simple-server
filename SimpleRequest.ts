/*
 * Copyright 2021, alex at staticlibs.net
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ServerRequest, readAll } from "./deps.ts";
import { JsonValue, SimpleResponse } from "./types.ts";
import SimpleServer from "./SimpleServer.ts";

const decoder = new TextDecoder();

export default class SimpleRequest {
  server: SimpleServer;
  req: ServerRequest;

  constructor(server: SimpleServer, req: ServerRequest) {
    this.server = server;
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

  get done(): Promise<Error | undefined> {
    return this.req.done;
  }

  get impl(): ServerRequest {
    return this.req;
  }

  async respond(r: SimpleResponse) {
    if (r.json) {
      r.body = JSON.stringify(r.json, null, 4);
      if (!r.headers) {
        r.headers = new Headers();
      }
      r.headers.set("content-type", "application/json");
    }
    await this.req.respond(r);
  }

}
