export interface ErrorCaptureOptions {
	debounceMs?: number;
}

export interface ToolResultLike {
	toolName: string;
	content?: Array<{ type: string; text?: string }>;
	details?: Record<string, unknown>;
	isError?: boolean;
}

const ERROR_PATTERNS: ReadonlyArray<RegExp> = [
	/Error:/,
	/Exception:/i,
	/Traceback/i,
	/\bfailed\b/i,
	/panic:/i,
	/fatal:/i,
];

export class ErrorCapture {
	private readonly debounceMs: number;
	private readonly recent = new Map<string, number>();

	constructor(options: ErrorCaptureOptions = {}) {
		this.debounceMs = options.debounceMs ?? 60_000;
	}

	detect(event: ToolResultLike): boolean {
		if (event.toolName.startsWith("tff-memory_")) return false;
		if (event.isError === true) return true;

		const details = event.details ?? {};
		const exitCode = details.exitCode;
		if (typeof exitCode === "number" && exitCode !== 0) return true;

		const stderr = details.stderr;
		if (typeof stderr === "string" && stderr.length > 0) return true;

		const text = this.joinText(event.content);
		return ERROR_PATTERNS.some((pattern) => pattern.test(text));
	}

	extractSummary(event: ToolResultLike, maxLength = 200): string {
		const text = this.joinText(event.content);
		const lines = text
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
		if (lines.length === 0) return "";

		const errorLine = lines.find((line) => ERROR_PATTERNS.some((p) => p.test(line)));
		const chosen = errorLine ?? lines[0] ?? "";
		return chosen.length > maxLength ? `${chosen.slice(0, maxLength - 1)}…` : chosen;
	}

	shouldCapture(event: ToolResultLike): boolean {
		if (!this.detect(event)) return false;
		const signature = `${event.toolName}|${this.extractSummary(event, 80)}`;
		const now = Date.now();
		const last = this.recent.get(signature);
		if (last !== undefined && now - last < this.debounceMs) return false;
		this.recent.set(signature, now);
		return true;
	}

	private joinText(content: ToolResultLike["content"]): string {
		if (!content) return "";
		return content
			.map((c) => (c.type === "text" && typeof c.text === "string" ? c.text : ""))
			.join("\n");
	}
}
