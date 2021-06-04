import { HTTPOptions, HTTPSOptions, serve, serveTLS } from "./deps.ts";

import { FileServer } from "./types.ts";

export default (
  options: HTTPOptions | HTTPSOptions,
): FileServer => {
  let srv = null;
  if ("certFile" in options) {
    srv = serveTLS(options);
  } else {
    srv = serve(options);
  }
  return {
    srv,
    close() {
      this.srv.close();
    },
    async broadcastWebsocket() {
    },
  };
};
