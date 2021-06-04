
 import{
  serve 
} from "https://deno.land/std@0.97.0/http/mod.ts";

import {
  posix,
  extname 
} from "https://deno.land/std@0.97.0/path/mod.ts";

import {
  acceptWebSocket,
  isWebSocketCloseEvent,
  isWebSocketPingEvent
} from "https://deno.land/std@0.97.0/ws/mod.ts";

const encoder = new TextEncoder();
const target = Deno.cwd();
const wsocks = [];

const MEDIA_TYPES = {
  ".html": "text/html",
  ".json": "application/json",
  ".txt": "text/plain",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};

function contentType(path1) {
  return MEDIA_TYPES[extname(path1)];
}

function html(strings, ...values) {
  const l = strings.length - 1;
  let html1 = "";
  for (let i = 0; i < l; i++) {
    let v = values[i];
    if (v instanceof Array) {
      v = v.join("");
    }
    const s = strings[i] + v;
    html1 += s;
  }
  html1 += strings[l];
  return html1;
}

function dirViewerTemplate(dirname, entries) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>File Server</title>
      </head>
      <body>
        <main>
          <h1>Index of ${dirname}</h1>
          <table>
            ${
    entries.map(
      (entry) =>
        html`
                  <tr>
                    <td>
                      <a href="${entry.url}">${entry.name}</a>
                    </td>
                  </tr>
                `,
    )
  }
          </table>
        </main>
      </body>
    </html>
  `;
}

async function serveFile(req, filePath) {
  const fileInfo = await Deno.stat(filePath);
  const file = await Deno.open(filePath);
  
  const headers = new Headers();
  headers.set("content-length", fileInfo.size.toString());
  const contentTypeValue = contentType(filePath);
  if (contentTypeValue) {
    headers.set("content-type", contentTypeValue);
  }
  req.done.then(() => {
    file.close();
  });
  return {
    status: 200,
    body: file,
    headers,
  };
}

async function serveDir(req, dirPath) {
  const showDotfiles = true;
  const dirUrl = `/${posix.relative(target, dirPath)}`;
  const listEntry = [];
  if (dirUrl !== "/") {
    const prevPath = posix.join(dirPath, "..");
    const fileInfo = await Deno.stat(prevPath);
    listEntry.push({
      name: "../",
      url: posix.join(dirUrl, ".."),
    });
  }
  for await (const entry of Deno.readDir(dirPath)) {
    if (!showDotfiles && entry.name[0] === ".") {
      continue;
    }
    const filePath = posix.join(dirPath, entry.name);
    const fileUrl = posix.join(dirUrl, entry.name);
    const fileInfo = await Deno.stat(filePath);
    listEntry.push({
      name: `${entry.name}${entry.isDirectory ? "/" : ""}`,
      url: `${fileUrl}${entry.isDirectory ? "/" : ""}`,
    });
  }
  listEntry.sort((a, b) =>
    a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1
  );
  const formattedDirUrl = `${dirUrl.replace(/\/$/, "")}/`;
  const page = encoder.encode(dirViewerTemplate(formattedDirUrl, listEntry));
  const headers = new Headers();
  headers.set("content-type", "text/html");
  const res = {
    status: 200,
    body: page,
    headers,
  };
  return res;
}
async function serveFallback(_req, e) {
  if (e instanceof URIError) {
    return {
      status: 400,
      body: encoder.encode("Bad Request"),
    };
  } else if (e instanceof Deno.errors.NotFound) {
    return {
      status: 404,
      body: encoder.encode("Not Found"),
    };
  } else {
    return {
      status: 500,
      body: encoder.encode("Internal server error"),
    };
  }
}

function normalizeURL(url) {
  let normalizedUrl = url;
  try {
    normalizedUrl = decodeURI(normalizedUrl);
  } catch (e) {
    if (!(e instanceof URIError)) {
      throw e;
    }
  }
  try {
    const absoluteURI = new URL(normalizedUrl);
    normalizedUrl = absoluteURI.pathname;
  } catch (e) {
    if (!(e instanceof TypeError)) {
      throw e;
    }
  }
  if (normalizedUrl[0] !== "/") {
    throw new URIError("The request URI is malformed.");
  }
  normalizedUrl = posix.normalize(normalizedUrl);
  const startOfParams = normalizedUrl.indexOf("?");
  return startOfParams > -1
    ? normalizedUrl.slice(0, startOfParams)
    : normalizedUrl;
}

async function handleFile(req) {
  let response;
  try {
    const normalizedUrl = normalizeURL(req.url);
    let fsPath = posix.join(target, normalizedUrl);
    if (fsPath.indexOf(target) !== 0) {
      fsPath = target;
    }
    const fileInfo = await Deno.stat(fsPath);
    if (fileInfo.isDirectory) {
      response = await serveDir(req, fsPath);
    } else {
      response = await serveFile(req, fsPath);
    }
  } catch (e) {
    console.error(e);
    response = await serveFallback(req, e);
  } finally {
    //serverLog(req, response);
    try {
      await req.respond(response);
    } catch (e) {
      console.error(e.message);
    }
  }
}

async function handleApi(req) {
  for (const ws of wsocks) {
    if (!ws.isClosed) {
      ws.send("hiws!");
    }
  }
  await req.respond({
    status: 200,
    body: encoder.encode("Hi!"),
  });
}

async function handleWebsocket(sock) {
  wsocks.push(sock);
  console.log("socket connected!");
  try {
    for await (const ev of sock) {
      if (typeof ev === "string") {
        // text message.
        console.log("ws:Text", ev);
        await sock.send(ev);
      } else if (ev instanceof Uint8Array) {
        // binary message.
        console.log("ws:Binary", ev);
      } else if (isWebSocketPingEvent(ev)) {
        const [, body] = ev;
        // ping.
        console.log("ws:Ping", body);
      } else if (isWebSocketCloseEvent(ev)) {
        // close.
        const { code, reason } = ev;
        console.log("ws:Close", code, reason);
      }
    }
  } catch (err) {
    console.error(`failed to receive frame: ${err}`);

    if (!sock.isClosed) {
      await sock.close(1000).catch(console.error);
    }
  }
}

export class Server {
  constructor({
    host = "127.0.0.1",
    port = 8080,
    rootDirectory,
    httpPath = "/api",
    httpHandler,
    websocketPath = "/websocket",
    websocketHandler
   } = {})
}

export async function receiveRequests(server) {
  for await (const req of server) {
    if (req.url == "/websocket") {
      const { conn, r: bufReader, w: bufWriter, headers } = req;
      // todo: checkme
      const sock = await acceptWebSocket({
        conn,
        bufReader,
        bufWriter,
        headers,
      });
      try {
          handleWebsocket(sock)
      } catch(e) {
          console.error(`failed to accept websocket: ${err}`);
          await req.respond({ status: 400 });
      }
    } else if (req.url.startsWith("/api/")) {
      handleApi(req);
    } else {
      handleFile(req);
    }
  }

}