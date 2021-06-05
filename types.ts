import {
  HTTPOptions,
  HTTPSOptions,
  Response,
  WebSocket,
  WebSocketEvent,
} from "./deps.ts";

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
};

export interface SimpleResponse extends Response {
  json?: { [key: string]: JsonValue } | JsonValue[];
}

export type HttpHandler = (req: SimpleRequest) => Promise<SimpleResponse>;

export type HttpConfig = {
  path: string;
  handler: HttpHandler;
};

export type WebSocketHandler = (
  sock: WebSocket,
  ev: WebSocketEvent,
) => Promise<void>;

export type WebSocketConfig = {
  path: string;
  handler?: WebSocketHandler;
};

export type SimpleLogger = {
  info: (msg: string) => void,
  error: (msg: string) => void
};

export type ServerConfig = {
  listen: HTTPOptions | HTTPSOptions;
  files?: FilesConfig;
  http?: HttpConfig;
  websocket?: WebSocketConfig;
  rootRedirect?: string;
  logger?: SimpleLogger
};