
import {
  Server,
  ServerRequest
} from "./deps.ts";

type FileServer = {
  srv: Server,
  close: () => void,
  broadcastWebsocket: (msg: string) => Promise<void>
};

type HttpJsonHandler = (request: ServerRequest) => Promise<string>;

export type {
  FileServer,
  HttpJsonHandler
};