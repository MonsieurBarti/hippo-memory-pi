import { describe, expect, test } from "vitest";
import hippoMemoryExtension, {
	DEFAULT_CONFIG,
	HippoMemoryService,
	loadConfig,
	resolveRoots,
} from "../../src/index";

describe("hippo-memory-pi library exports", () => {
	test("default export is still a function", () => {
		expect(typeof hippoMemoryExtension).toBe("function");
	});

	test("HippoMemoryService is a constructor", () => {
		expect(typeof HippoMemoryService).toBe("function");
		expect(HippoMemoryService.prototype.init).toBeInstanceOf(Function);
		expect(HippoMemoryService.prototype.shutdown).toBeInstanceOf(Function);
	});

	test("loadConfig is a function and DEFAULT_CONFIG is an object", () => {
		expect(typeof loadConfig).toBe("function");
		expect(typeof DEFAULT_CONFIG).toBe("object");
		expect(DEFAULT_CONFIG.searchMode).toBe("hybrid");
	});

	test("resolveRoots is a function that returns projectRoot and globalRoot", () => {
		expect(typeof resolveRoots).toBe("function");
		const roots = resolveRoots({ cwd: "/tmp/x", config: {} });
		expect(typeof roots.projectRoot).toBe("string");
		expect(typeof roots.globalRoot).toBe("string");
	});
});
