Simple web server for Deno
==========================

Web server for [Deno](https://deno.land/) that allows to serve files from filesystem, respond to HTTP JSON calls and work with Websocket connections and broadcasts.

Uses only stable Deno API, has NO DEPENDENCIES, does NOT use stdlib.

Implemented as a thin wrapper over [Deno.serveHttp()](https://doc.deno.land/builtin/stable#Deno.serveHttp) and [Deno.upgradeWebSocket()](https://doc.deno.land/builtin/stable#Deno.upgradeWebSocket). Provides declarative configurations, logging support and tracks the usage of system resources.

Not a web-framework, does NOT include requests router or ORM, see [oak](https://deno.land/x/oak) and [aleph](https://deno.land/x/aleph) instead.

Usage examples
--------------

#### Command line file server

```
deno run --allow-read --allow-net https://raw.githubusercontent.com/notranspile-js/deno-simple-server/master/src/main.ts
```

See [main.ts](https://github.com/notranspile-js/deno-simple-server/blob/master/src/main.ts) to customize it.

#### HTTP, Websocket, logging, graceful shutdown

```
import { readLines } from "https://deno.land/std/io/bufio.ts";
import {
  SimpleResponse,
  SimpleRequest,
  SimpleServer,
} from "https://raw.githubusercontent.com/notranspile-js/deno-simple-server/master/src/mod.ts";

const server = new SimpleServer({
  listen: { // Deno.ListenOptions | Deno.ListenTlsOptions
    port: 8080,
  },
  files: {
    path: "/web",
    rootDirectory: Deno.cwd(),
    dirListingEnabled: true,
  },
  http: {
    path: "/api/",
    handler: async (req: SimpleRequest): Promise<Response | SimpleResponse> => {
      const msg = await req.json();
      return { // SimpleResponse
        json: {
          received: msg
        }
      };
    },
  },
  websocket: {
    path: "/websocket",
    onmessage: async (sock: WebSocket, ev: MessageEvent) => {
      const data = await Deno.lstat(Deno.cwd());
      const msg = JSON.stringify(data, null, 4);
      sock.send(msg);
    },
  },
  logger: {
    info: (msg: string) => console.log(msg),
    error: (msg: string) => console.log(msg),
  },
  rootRedirectLocation: "/web/",
});

console.log("Server started, url: [http://127.0.0.1:8080/], press Enter to stop ...");
for await (const _ of readLines(Deno.stdin)) {
  break;
}
console.log("Shutting down ...");
await server.close();
console.log("Shutdown complete");
```

License information
-------------------

This project is released under the [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0).