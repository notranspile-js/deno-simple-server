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

import { HttpConfig, SimpleLogger } from "./types.ts";
import SimpleRequest from "./SimpleRequest.ts";
import SimpleServer from "./SimpleServer.ts";
import respond500 from "./respond500.ts";

export default async (
  untrack: () => void,
  server: SimpleServer,
  logger: SimpleLogger,
  conf: HttpConfig,
  ev: Deno.RequestEvent,
) => {
  try {
    const path = new URL(ev.request.url).pathname;
    logger.info(`HTTP request received, method: [${ev.request.method}], url: [${path}]`);
    const sreq = new SimpleRequest(server, ev);
    const resp = await conf.handler(sreq);
    await sreq.respondWith(resp);
  } catch (e) {
    respond500(logger, ev, e);
  } finally {
    untrack();
  }
};
