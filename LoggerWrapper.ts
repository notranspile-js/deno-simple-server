
import { SimpleLogger } from "./types.ts";

export default class LoggerWrapper {
  sl?: SimpleLogger;

  constructor(sl?: SimpleLogger) {
    this.sl = sl;
  }

  info(msg: string) {
    if (this.sl?.info) {
      this.sl.info(msg);
    }
  }

  error(msg: string) {
    if (this.sl?.error) {
      this.sl.error(msg);
    }
  }
}