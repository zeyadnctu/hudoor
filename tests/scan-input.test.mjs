import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractScanToken } from "../.testbuild/scan-input.js";

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzaWQiOiJzZXNzLTEifQ.signaturepart";

describe("manual scan fallback", () => {
  it("extracts the token from a full scan URL", () => {
    assert.equal(extractScanToken(`https://hudoor.example/scan?t=${TOKEN}`), TOKEN);
  });

  it("accepts a scan URL without a protocol", () => {
    assert.equal(extractScanToken(`/scan?t=${TOKEN}`), TOKEN);
  });

  it("accepts the raw compact token", () => {
    assert.equal(extractScanToken(`  ${TOKEN}  `), TOKEN);
  });

  it("decodes URL-encoded tokens", () => {
    assert.equal(extractScanToken(`https://hudoor.example/scan?t=${encodeURIComponent(TOKEN)}`), TOKEN);
  });

  it("rejects short codes and unrelated text", () => {
    assert.equal(extractScanToken("123456"), null);
    assert.equal(extractScanToken("https://hudoor.example/scan"), null);
    assert.equal(extractScanToken("not a token"), null);
    assert.equal(extractScanToken(""), null);
  });
});
