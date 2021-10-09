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

import SimpleRequest from "./SimpleRequest.ts";
import respond500 from "./respond500.ts";

export default async (req: SimpleRequest): Promise<void> => {
  const logger = req.server.logger;
  const conf = req.server.conf.http!;
  try {
    logger.info(`HTTP request received, method: [${req.method}], path: [${req.path}]`);
    const resp = await conf.handler(req);
    await req.respondWith(resp);
  } catch (e) {
    await respond500(logger, req.ev, e);
  }
};
