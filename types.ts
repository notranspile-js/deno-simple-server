
import {
  HTTPOptions,
  HTTPSOptions,
  Response,
  ServerRequest,
  WebSocket,
  WebSocketEvent
} from "./deps.ts";

export type FilesConfig = {
  path: string,
  rootDirectory: string
};

export type HttpHandler = (req: ServerRequest) => Promise<Response>;

export type HttpConfig = {
  path: string,
  handler: HttpHandler
};

export type WebSocketHandler = (sock: WebSocket, ev: WebSocketEvent) => Promise<void>

export type WebSocketConfig = {
  path: string,
  handler?: WebSocketHandler
}

export type ServerConfig = {
  listen: HTTPOptions | HTTPSOptions,
  files?: FilesConfig,
  http?: HttpConfig,
  websocket?: WebSocketConfig,
  rootRedirect?: string 
};