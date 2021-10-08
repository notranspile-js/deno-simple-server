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

// export { readAll } from "https://deno.land/std@0.97.0/io/util.ts";

export { readableStreamFromReader } from "https://deno.land/std@0.110.0/io/streams.ts";

import * as posix from "https://deno.land/std@0.110.0/path/posix.ts";
export { posix };
