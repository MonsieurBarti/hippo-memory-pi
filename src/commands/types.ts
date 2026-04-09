export interface CommandUI {
	notify(message: string, level?: "info" | "warning" | "error"): void;
}

export interface CommandContext {
	ui: CommandUI;
	cwd: string;
}

export interface CommandDefinition {
	name: string;
	description: string;
	handler(args: string, ctx: CommandContext): Promise<void>;
}

export interface ToggleStore {
	isToggledOff(): boolean;
	toggle(): boolean;
}
