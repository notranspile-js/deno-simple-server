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

import SimpleConn from "./SimpleConn.ts";
import SimpleServer from "./SimpleServer.ts";
import { JsonValue, SimpleResponse } from "./types.ts";

export default class SimpleRequest {
  server: SimpleServer;
  conn: SimpleConn;
  ev: Deno.RequestEvent;
  onDone: (() => void)[];

  constructor(server: SimpleServer, conn: SimpleConn, ev: Deno.RequestEvent) {
    this.server = server;
    this.conn = conn;
    this.ev = ev;
    this.onDone = [];
  }

  // forward calls

  get cache(): RequestCache {
    return this.ev.request.cache;
  }

  get credentials(): RequestCredentials {
    return this.ev.request.credentials;
  }

  get destination(): RequestDestination {
    return this.ev.request.destination;
  }

  get headers(): Headers {
    return this.ev.request.headers;
  }

  get integrity(): string {
    return this.ev.request.integrity;
  }

  get isHistoryNavigation(): boolean {
    return this.ev.request.isHistoryNavigation;
  }

  get isReloadNavigation(): boolean {
    return this.ev.request.isReloadNavigation;
  }

  get keepalive(): boolean {
    return this.ev.request.keepalive;
  }

  get method(): string {
    return this.ev.request.method;
  }

  get mode(): RequestMode {
    return this.ev.request.mode;
  }

  get redirect(): RequestRedirect {
    return this.ev.request.redirect;
  }

  get referrer(): string {
    return this.ev.request.referrer;
  }

  get referrerPolicy(): ReferrerPolicy {
    return this.ev.request.referrerPolicy;
  }

  get signal(): AbortSignal {
    return this.ev.request.signal;
  }

  get url(): string {
    return this.ev.request.url;
  }

  get path(): string {
    return new URL(this.ev.request.url).pathname;
  }

  get body(): ReadableStream<Uint8Array> | null {
    return this.ev.request.body;
  }

  get bodyUsed(): boolean {
    return this.ev.request.bodyUsed;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return await this.ev.request.arrayBuffer();
  }

  async blob(): Promise<Blob> {
    return await this.ev.request.blob();
  }

  async formData(): Promise<FormData> {
    return await this.ev.request.formData();
  }

  // Promise<any> replaced
  async json<T extends JsonValue>(): Promise<T> {
    return await this.ev.request.json();
  }

  async text(): Promise<string> {
    return await this.ev.request.text();
  }

  async respondWith(r: SimpleResponse | Response): Promise<void> {
    if (r instanceof Response) {
      await this.ev.respondWith(r);
    } else {
      if (r?.json) {
        r.body = JSON.stringify(r.json, null, 4);
        if (!r.headers) {
          r.headers = new Headers();
        }
        r.headers.set("content-type", "application/json");
      }
      const resp = new Response(r?.body, {
        headers: r?.headers,
        status: r?.status,
        statusText: r?.statusText,
      });

      await this.ev.respondWith(resp);

      for (const fun of this.onDone) {
        try {
          fun();
        } catch (e) {
          this.server.logger.error(String(e));
        }
      }
    }
  }

  get done(): Promise<void> {
    return new Promise((resolve) => {
      this.onDone.push(resolve);
    });
  }
}
