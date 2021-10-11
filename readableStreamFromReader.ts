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

// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
// https://deno.land/std@0.110.0/io/streams.ts

const CHUNK_SIZE = 16_640;

export default (reader: (Deno.Reader & Deno.Closer)): ReadableStream<Uint8Array> => {

  return new ReadableStream({
    async pull(controller) {
      const chunk = new Uint8Array(CHUNK_SIZE);
      try {
        const read = await reader.read(chunk);
        if (read === null) {
          reader.close();
          controller.close();
          return;
        }
        controller.enqueue(chunk.subarray(0, read));
      } catch (e) {
        controller.error(e);
        reader.close();
      }
    },
    cancel() {
      reader.close();
    },
  });
}