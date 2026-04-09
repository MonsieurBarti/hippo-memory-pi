import { describe, expect, test } from "vitest";
import { createAllCommands, createToggleStore } from "../../../src/commands";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("createAllCommands", () => {
	test("returns all 6 commands", () => {
		const commands = createAllCommands({
			service: createFakeService(),
			toggleStore: createToggleStore(),
		});
		expect(commands).toHaveLength(6);
		const names = commands.map((c) => c.name).sort();
		expect(names).toEqual([
			"memory-conflicts",
			"memory-inspect",
			"memory-recall",
			"memory-sleep",
			"memory-status",
			"toggle-hippo-memory",
		]);
	});

	test("every command exposes the structural shape", () => {
		const commands = createAllCommands({
			service: createFakeService(),
			toggleStore: createToggleStore(),
		});
		for (const cmd of commands) {
			expect(typeof cmd.name).toBe("string");
			expect(typeof cmd.description).toBe("string");
			expect(typeof cmd.handler).toBe("function");
		}
	});
});
