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

import handleFile from "../src/handleFile.ts";
import SimpleConn from "../src/SimpleConn.ts";
import SimpleRequest from "../src/SimpleRequest.ts";
import SimpleServer from "../src/SimpleServer.ts";
import closeQuietly from "../src/util/closeQuietly.ts";

import { assert, assertEquals, path } from "./test_deps.ts";

const dir = Deno.makeTempDirSync();
Deno.writeTextFileSync(path.join(dir, "foo.txt"), "foo");
Deno.writeTextFileSync(path.join(dir, "bar.txt"), "bar");
const subdir = path.join(dir, "baz");
Deno.mkdirSync(subdir);
Deno.writeTextFileSync(path.join(subdir, "boo.txt"), "boo");
Deno.writeTextFileSync(path.join(subdir, "bee.txt"), "bee");
const idxdir = path.join(dir, "idx");
Deno.mkdirSync(idxdir);
Deno.writeTextFileSync(path.join(idxdir, "baa.txt"), "baa");
Deno.writeTextFileSync(path.join(idxdir, "index.html"), "index");

const server: SimpleServer = {
  conf: {
    files: {
      path: "/files/",
      rootDirectory: dir,
      dirListingEnabled: true,
    },
  },
  logger: {
    info() {},
    error(_msg: string) {
      //console.log(msg)
    },
  },
} as unknown as SimpleServer;

const httpPromises: Promise<void>[] = [];
const activeConns: Deno.HttpConn[] = [];

async function handleTcpConn(listener: Deno.Listener): Promise<void> {
  for await (const tcpConn of listener) {
    const pr = handleHttpConn(tcpConn);
    httpPromises.push(pr);
  }
}

async function handleHttpConn(tcpConn: Deno.Conn): Promise<void> {
  const httpConn = Deno.serveHttp(tcpConn);
  activeConns.push(httpConn);
  for await (const ev of httpConn) {
    const req = new SimpleRequest(server, null as unknown as SimpleConn, ev);
    await handleFile(req);
  }
}

Deno.test("handleFile", async () => {
  const listener = Deno.listen({ port: 8080 });
  const serverPromise = handleTcpConn(listener);

  { // file
    const resp = await fetch("http://127.0.0.1:8080/files/foo.txt");
    assertEquals(resp.status, 200);
    assertEquals(await resp.text(), "foo");
  }

  { // file in dir
    const resp = await fetch("http://127.0.0.1:8080/files/baz/boo.txt");
    assertEquals(resp.status, 200);
    assertEquals(resp.headers.get("Content-Type"), "text/plain");
    assertEquals(await resp.text(), "boo");
  }

  { // dir listing
    const resp = await fetch("http://127.0.0.1:8080/files/baz/boo.txt");
    assertEquals(resp.status, 200);
    assertEquals(resp.headers.get("Content-Type"), "text/plain");
    assertEquals(await resp.text(), "boo");
  }

  { // dir listing
    const resp = await fetch("http://127.0.0.1:8080/files/baz/");
    assertEquals(resp.status, 200);
    assertEquals(resp.headers.get("Content-Type"), "text/html");
    const html = await resp.text();
    assert(html.includes('href="/files/baz/boo.txt"'));
    assert(html.includes('href="/files/baz/bee.txt"'));
  }

  { // index.html
    const resp = await fetch("http://127.0.0.1:8080/files/idx/");
    assertEquals(resp.status, 200);
    assertEquals(resp.headers.get("Content-Type"), "text/html");
    assertEquals(await resp.text(), "index");
  }

  { // 404
    const resp = await fetch("http://127.0.0.1:8080/files/fail.txt");
    assertEquals(resp.status, 404);
    await resp.text();
  }

  // cleanup

  for (const hc of activeConns) {
    closeQuietly(hc);
  }
  await Promise.allSettled(httpPromises);
  listener.close();
  await serverPromise;

  Deno.removeSync(dir, { recursive: true });
});
