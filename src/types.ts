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

import SimpleRequest from "./SimpleRequest.ts";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type FilesConfig = {
  path: string;
  rootDirectory: string;
  dirListingEnabled: boolean;
};

export type SimpleResponse = {
  status?: number;
  statusText?: string;
  headers?: Headers;
  body?: BodyInit;
  json?: { [key: string]: JsonValue } | JsonValue[];
};

export type HttpHandler = (
  req: SimpleRequest,
) => Promise<SimpleResponse | Response>;

export type HttpConfig = {
  path: string;
  handler: HttpHandler;
};

export type WebSocketConfig = {
  path: string;
  onopen?: (sock: WebSocket, ev: Event) => Promise<void>;
  onmessage?: (sock: WebSocket, ev: MessageEvent) => Promise<void>;
  onerror?: (sock: WebSocket, ev: Event | ErrorEvent) => Promise<void>;
  onclose?: (sock: WebSocket, ev: CloseEvent) => Promise<void>;
};

export type SimpleLogger = {
  info: (msg: string) => void;
  error: (msg: string) => void;
};

export type ServerConfig = {
  listen: Deno.ListenOptions | Deno.ListenTlsOptions;
  files?: FilesConfig;
  http?: HttpConfig;
  websocket?: WebSocketConfig;
  rootRedirectLocation?: string;
  logger?: SimpleLogger;
};

export type ServerStatus = {
  listenerActive: boolean;
  activeConnections: number;
  activeWebSockets: number;
};

export type EntryInfo = {
  size: string;
  url: string;
  name: string;
  isDirectory: boolean;
};
