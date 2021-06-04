
import createServer from "../createServer.ts";

Deno.test("create and close", () => {
  const srv = createServer({
    port: 8080
  });
  srv.close();
});