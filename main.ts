
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
    }
  });
  console.log(`Server started, url: [http://127.0.0.1:${port}] ...`);
  // serve forever
  await server.shutdownPromise;
}