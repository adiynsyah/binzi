/*
 * Body reading with a byte budget (card S1-04 §1) for the two content
 * endpoints (lesson text, course description). request.json() would read
 * the WHOLE body unbounded — and Content-Length can be absent (chunked)
 * or lie — so the body is counted BYTES per chunk while it streams in and
 * the read is cancelled the moment the budget is exceeded. The role guard
 * runs BEFORE this in every caller, so an unauthorized request can never
 * make the server read a large body.
 */

import { BadRequestError, PayloadTooLargeError } from "./errors";

/** 1 MiB: the validator limits (100k characters, 5k nodes) fit comfortably. */
export const MAX_CONTENT_BODY_BYTES = 1_048_576;

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  // 1. Header first: an honest Content-Length over budget is rejected
  //    before a single byte is read. A non-numeric header is ignored —
  //    the stream count below stays the authority either way.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new PayloadTooLargeError();
  }

  // 2. Then the body: chunks are counted by byteLength (multibyte text
  //    means characters ≠ bytes), accumulated, and decoded once at the
  //    end. Crossing the budget cancels the reader and throws — this is
  //    also what catches chunked bodies without Content-Length.
  const chunks: Uint8Array[] = [];
  let received = 0;
  if (request.body !== null) {
    const reader = request.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > maxBytes) {
          await reader.cancel();
          throw new PayloadTooLargeError();
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  const total = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    total.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(total));
  } catch {
    // Empty and malformed bodies answer the same 400 copy as the S1-02
    // routes' request.json() catch.
    throw new BadRequestError("Body permintaan harus JSON valid");
  }
}
