import { vi } from "vitest";
import type { CommandContext } from "../../src/commands/types";

export interface FakeCommandContext extends CommandContext {
	readonly notifications: ReadonlyArray<{ message: string; level: "info" | "warning" | "error" }>;
}

export function createFakeCommandContext(cwd = "/tmp/proj"): FakeCommandContext {
	const notifications: Array<{ message: string; level: "info" | "warning" | "error" }> = [];
	const ctx: FakeCommandContext = {
		cwd,
		notifications,
		ui: {
			notify: vi.fn((message: string, level: "info" | "warning" | "error" = "info") => {
				notifications.push({ message, level });
			}),
		},
	};
	return ctx;
}
