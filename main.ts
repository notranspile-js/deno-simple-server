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

import SimpleServer from "./SimpleServer.ts";

if (import.meta.main) {
  let port = 8080;
  if (Deno.args.length > 0) {
    port = parseInt(Deno.args[0]);
  }
  const server = new SimpleServer({
    listen: {
      port: port
    },
    files: {
      path: "/",
      rootDirectory: Deno.cwd(),
      dirListingEnabled: true
    },
    logger: {
      info: (msg: string) => console.log(msg),
      error: (msg: string) => console.log(msg),
    },
  });
  console.log(`Server started, url: [http://127.0.0.1:${port}] ...`);
  // serve forever
  await server.running;
}