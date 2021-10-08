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

import { posix, readableStreamFromReader } from "./deps.ts";

import { EntryInfo, FilesConfig, SimpleLogger } from "./types.ts";
import dirViewerTemplate from "./dirViewerTemplate.ts";
import normalizeURL from "./normalizeURL.ts";
import respond400 from "./respond400.ts";
import respond404 from "./respond404.ts";
import respond500 from "./respond500.ts";

const encoder = new TextEncoder();

const MEDIA_TYPES: Record<string, string> = {
  ".md": "text/markdown",
  ".html": "text/html",
  ".htm": "text/html",
  ".json": "application/json",
  ".map": "application/json",
  ".txt": "text/plain",
  ".js": "application/javascript",
  ".ts": "text/javascript",
  ".gz": "application/gzip",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
};

function fileLenToString(len: number): string {
  const multiplier = 1024;
  let base = 1;
  const suffix = ["B", "K", "M", "G", "T"];
  let suffixIndex = 0;

  while (base * multiplier < len) {
    if (suffixIndex >= suffix.length - 1) {
      break;
    }
    base *= multiplier;
    suffixIndex++;
  }

  return `${(len / base).toFixed(2)}${suffix[suffixIndex]}`;
}

async function serveFile(
  logger: SimpleLogger,
  ev: Deno.RequestEvent,
  filePath: string,
): Promise<void> {
  const [file, fileInfo] = await Promise.all([
    Deno.open(filePath),
    Deno.stat(filePath),
  ]);
  const headers = new Headers();
  headers.set("content-length", fileInfo.size.toString());
  const contentType = MEDIA_TYPES[posix.extname(filePath)];
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const stream = readableStreamFromReader(file);
  respondNoThrow(
    logger,
    ev,
    new Response(stream, {
      status: 200,
      headers,
    }),
  );
}

async function serveDir(
  logger: SimpleLogger,
  conf: FilesConfig,
  ev: Deno.RequestEvent,
  dirPath: string,
): Promise<void> {
  const dirUrl = `/${posix.relative(conf.rootDirectory, dirPath)}`;
  const listEntry: EntryInfo[] = [];

  // if ".." makes sense
  if (dirUrl !== "/") {
    listEntry.push({
      size: "",
      name: "../",
      url: posix.join(dirUrl, ".."),
      isDirectory: true,
    });
  }

  for await (const entry of Deno.readDir(dirPath)) {
    const filePath = posix.join(dirPath, entry.name);
    if (entry.name === "index.html" && entry.isFile) {
      // in case index.html as dir...
      serveFile(logger, ev, filePath);
      return;
    }
    const fileUrl = posix.join(dirUrl, entry.name);
    const fileInfo = await Deno.stat(filePath);
    listEntry.push({
      size: entry.isFile ? fileLenToString(fileInfo.size ?? 0) : "",
      name: `${entry.name}${entry.isDirectory ? "/" : ""}`,
      url: posix.normalize(
        `${conf.path}${fileUrl}${entry.isDirectory ? "/" : ""}`,
      ),
      isDirectory: entry.isDirectory,
    });
  }
  listEntry.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) {
      return -1;
    } else if (!a.isDirectory && b.isDirectory) {
      return 1;
    }
    return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
  });
  const formattedDirUrl = `${dirUrl.replace(/\/$/, "")}/`;
  const page = encoder.encode(dirViewerTemplate(formattedDirUrl, listEntry));

  const headers = new Headers();
  headers.set("content-type", "text/html");

  respondNoThrow(
    logger,
    ev,
    new Response(page, {
      status: 200,
      headers,
    }),
  );
}

async function respondNoThrow(
  logger: SimpleLogger,
  req: Deno.RequestEvent,
  resp: Response,
) {
  try {
    await req.respondWith(resp);
  } catch (e) {
    respond500(logger, req, e);
  }
}

export default async (
  untrack: () => void,
  logger: SimpleLogger,
  conf: FilesConfig,
  ev: Deno.RequestEvent,
) => {
  let fsPath = "";
  try {
    const path = new URL(ev.request.url).pathname;
    const relativeUrl = path.substring(conf.path.length);
    const normalizedUrl = normalizeURL(relativeUrl);
    fsPath = posix.join(conf.rootDirectory, normalizedUrl);
    const fileInfo = await Deno.stat(fsPath);
    if (fileInfo.isDirectory) {
      if (conf.dirListingEnabled) {
        await serveDir(logger, conf, ev, fsPath);
      } else {
        throw new Deno.errors.NotFound();
      }
    } else {
      await serveFile(logger, ev, fsPath);
    }
  } catch (e) {
    logger.error(`Error serving file, path: [${fsPath}]`);
    if (e instanceof URIError) {
      respond400(logger, ev);
    } else if (e instanceof Deno.errors.NotFound) {
      respond404(logger, ev);
    } else {
      respond500(logger, ev, e);
    }
  } finally {
    untrack();
  }
};
