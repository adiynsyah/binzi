// Unit tests for the budgeted body reader (card S1-04 §1 "Tes readJsonBody").
// Node env on purpose: real Request objects (undici) plus a duck-typed
// request for the forged-Content-Length case — a Request constructor never
// lets a caller lie about that header.
import { describe, expect, it } from "vitest";

import { BadRequestError, PayloadTooLargeError } from "./errors";
import { readJsonBody } from "./request-body";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function streamRequest(...chunks: string[]): Request {
  // duplex is required by undici for stream bodies but absent from the DOM
  // lib's RequestInit — hence the cast (test-only).
  const init = {
    method: "PUT",
    body: streamOf(...chunks),
    duplex: "half",
  } as unknown as RequestInit;
  return new Request("http://localhost/api", init);
}

/** Duck-typed request: headers/body are all readJsonBody touches. */
function forgedLengthRequest(header: string, ...chunks: string[]): Request {
  return {
    headers: new Headers({ "content-length": header }),
    body: streamOf(...chunks),
  } as unknown as Request;
}

describe("readJsonBody", () => {
  it("reads a body of exactly maxBytes", async () => {
    // '{"x":1234}' is exactly 10 ASCII bytes.
    const exact = new Request("http://localhost/api", {
      method: "PUT",
      body: '{"x":1234}',
    });
    await expect(readJsonBody(exact, 10)).resolves.toEqual({ x: 1234 });

    const exactStream = streamRequest('{"x":123', "4}");
    await expect(readJsonBody(exactStream, 10)).resolves.toEqual({ x: 1234 });
  });

  it("maxBytes + 1 → PayloadTooLargeError with an honest Content-Length", async () => {
    const honest = new Request("http://localhost/api", {
      method: "PUT",
      body: '{"x":12345}', // 11 bytes, header says 11
    });
    await expect(readJsonBody(honest, 10)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
  });

  it("maxBytes + 1 → PayloadTooLargeError as a stream without Content-Length", async () => {
    const chunked = streamRequest('{"x":1234', "5}"); // 11 bytes, no header
    await expect(readJsonBody(chunked, 10)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
  });

  it("a small lying Content-Length with a big body still gets 413 (stream count)", async () => {
    const lying = forgedLengthRequest("10", '{"x":"', "aaaaaaaaaaaaaaaaaa");
    await expect(readJsonBody(lying, 10)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
  });

  it("counts BYTES, not characters: multibyte text under maxBytes chars but over maxBytes bytes → 413", async () => {
    // 6 characters of é = 12 UTF-8 bytes > 10.
    const multibyte = streamRequest("éééééé");
    await expect(readJsonBody(multibyte, 10)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
  });

  it("broken JSON → BadRequestError with the S1-02 copy", async () => {
    const broken = new Request("http://localhost/api", {
      method: "PUT",
      body: '{"x":',
    });
    await expect(readJsonBody(broken, 100)).rejects.toThrow(
      new BadRequestError("Body permintaan harus JSON valid"),
    );
  });

  it("empty body → BadRequestError", async () => {
    const none = new Request("http://localhost/api", { method: "PUT" });
    await expect(readJsonBody(none, 100)).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });
});
