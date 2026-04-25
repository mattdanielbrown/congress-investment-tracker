import { describe, expect, it } from "vitest";

import { sha256 } from "../../src/utils/hash.js";

describe("sha256", () => {
	it("computes deterministic hashes for strings", () => {
		expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
	});

	it("computes deterministic hashes for buffers", () => {
		expect(sha256(Buffer.from("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
	});

	it("hashes empty input", () => {
		expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
	});
});
