import { describe, expect, test } from "vitest";
import {
	createToggleAutoInjectCommand,
	createToggleStore,
} from "../../../src/commands/toggle-auto-inject";
import { createFakeCommandContext } from "../../fixtures/fake-command-context";

describe("createToggleStore", () => {
	test("starts in the ON state (not toggled off)", () => {
		const store = createToggleStore();
		expect(store.isToggledOff()).toBe(false);
	});

	test("toggle flips state and returns the new value", () => {
		const store = createToggleStore();
		expect(store.toggle()).toBe(true);
		expect(store.isToggledOff()).toBe(true);
		expect(store.toggle()).toBe(false);
		expect(store.isToggledOff()).toBe(false);
	});
});

describe("/toggle-hippo-memory command", () => {
	test("notifies the new state on each invocation", async () => {
		const store = createToggleStore();
		const cmd = createToggleAutoInjectCommand(store);
		const ctx = createFakeCommandContext();

		await cmd.handler("", ctx);
		expect(ctx.notifications.at(-1)?.message).toContain("OFF");

		await cmd.handler("", ctx);
		expect(ctx.notifications.at(-1)?.message).toContain("ON");
	});

	test("exposes name + description", () => {
		const cmd = createToggleAutoInjectCommand(createToggleStore());
		expect(cmd.name).toBe("toggle-hippo-memory");
		expect(cmd.description).toBeTruthy();
	});
});
