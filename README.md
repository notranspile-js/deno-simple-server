Simple web server for Deno
==========================

Web server for Deno based on [std/http](https://deno.land/std/http) that supports serving files from filesystem, responding to HTTP JSON calls, working with Websocket connections and broadcasts.

Usage examples
--------------

#### Minimal File server

```
import { SimpleServer } from "https://raw.githubusercontent.com/notranspile-js/deno-simple-server/1.0.1/mod.ts";

const server = new SimpleServer({
  listen: {
    port: 8080,
  },
  files: {
    path: "/web",
    rootDirectory: Deno.cwd(),
    dirListingEnabled: true,
  },
});
console.log(Deno.cwd());
console.log(`Server started, url: [http://127.0.0.1:8080/web/] ...`);
// serve forever
```

#### HTTP and WebSocket handlers, logging

```
import {
  WebSocket,
  WebSocketEvent,
} from "https://deno.land/std@0.97.0/ws/mod.ts";
import {
  SimpleRequest,
  SimpleServer,
} from "https://raw.githubusercontent.com/notranspile-js/deno-simple-server/1.0.1/mod.ts";

const server = new SimpleServer({
  listen: { // HTTPOptions | HTTPSOptions
    port: 8080,
  },
  files: {
    path: "/web",
    rootDirectory: Deno.cwd(),
    dirListingEnabled: true,
  },
  http: {
    path: "/api/",
    handler: async (req: SimpleRequest) => {
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
    handler: async (sock: WebSocket, ev: WebSocketEvent) => {
      if (typeof ev === "string") {
        await sock.send(ev);
      }
    },
  },
  logger: {
    info: (msg: string) => console.log(msg),
    error: (msg: string) => console.log(msg),
  },
  rootRedirectLocation: "/web/",
});
console.log("Server started, url: [http://127.0.0.1:8080/] ...");
```

#### Graceful shutdown

```
const server = new Server(...);
console.log("Press Enter to stop");
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