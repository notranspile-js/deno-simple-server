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

import { SimpleLogger } from "../types.ts";

export default async (logger: SimpleLogger, ev: Deno.RequestEvent) => {
  const path = new URL(ev.request.url).pathname;
  const msg = `Bad Request, method: [${ev.request.method}], path: [${path}]`;
  logger.error(msg);
  const headers = new Headers();
  headers.set("content-type", "application/json");
  try {
    await ev.respondWith(
      new Response(
        JSON.stringify(
          {
            error: "400 Bad Request",
            path: path,
          },
          null,
          4,
        ),
        {
          status: 400,
          headers,
        },
      ),
    );
  } catch (_) {
    // ignore
  }
};
