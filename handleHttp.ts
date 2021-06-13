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

import { ServerRequest } from "./deps.ts";

import { HttpConfig, SimpleLogger } from "./types.ts";
import SimpleRequest from "./SimpleRequest.ts";
import SimpleServer from "./SimpleServer.ts";
import respond500 from "./respond500.ts";

export default async (
  untrack: () => void,
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
  } finally {
    untrack();
  }
};
