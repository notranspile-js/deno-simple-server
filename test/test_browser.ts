
import SimpleRequest from "../SimpleRequest.ts";
import SimpleServer from "../SimpleServer.ts";
import { dirname } from "./test_deps.ts";

if (import.meta.main) {
  const server = new SimpleServer({
    listen: {
      port: 8080
    },
    files: {
      path: "/web/",
      rootDirectory: dirname(import.meta.url).substring("file://".length),
      dirListingEnabled: true
    },
    websocket: {
      path: "/websocket"
    },
    http: {
      path: "/api/",
      handler: async (req: SimpleRequest) => {
        const msg = await req.json();
        await req.server.broadcastWebsocket({
          received: msg
        });
        return {}
      }
    }, logger: {
      info: (msg: string) => console.log(msg),
      error: (msg: string) => console.log(msg)
    }
  });
  console.log("Server started, url: [http://127.0.0.1:8080/] ...")
  await server.done;
}