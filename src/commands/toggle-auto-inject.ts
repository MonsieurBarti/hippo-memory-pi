import type { CommandContext, CommandDefinition, ToggleStore } from "./types";

export function createToggleStore(): ToggleStore {
	let off = false;
	return {
		isToggledOff() {
			return off;
		},
		toggle() {
			off = !off;
			return off;
		},
	};
}

export function createToggleAutoInjectCommand(store: ToggleStore): CommandDefinition {
	return {
		name: "toggle-hippo-memory",
		description: "Toggle auto-injection of memory context for this session",
		async handler(_args: string, ctx: CommandContext) {
			const off = store.toggle();
			ctx.ui.notify(
				off
					? "🧠 Hippo memory auto-inject: OFF for this session"
					: "🧠 Hippo memory auto-inject: ON",
				"info",
			);
		},
	};
}
