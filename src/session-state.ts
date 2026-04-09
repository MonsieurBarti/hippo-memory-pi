import type { ToolResultSummary } from "./success-detector";

export interface SessionState {
	setAnchorIds(ids: readonly string[]): void;
	getAnchorIds(): readonly string[];
	clearAnchorIds(): void;
	recordToolResult(result: ToolResultSummary): void;
	getRecentToolResults(): readonly ToolResultSummary[];
}

export interface SessionStateOptions {
	ringSize?: number;
}

/**
 * Create a fresh session state tracker. All state is in-process; the
 * lifetime matches the extension instance that the hook factories close
 * over (typically the duration of a single pi session).
 */
export function createSessionState(options: SessionStateOptions = {}): SessionState {
	const ringSize = options.ringSize ?? 10;
	let anchorIds: readonly string[] = [];
	const ring: ToolResultSummary[] = [];

	return {
		setAnchorIds(ids) {
			anchorIds = [...ids];
		},
		getAnchorIds() {
			return anchorIds;
		},
		clearAnchorIds() {
			anchorIds = [];
		},
		recordToolResult(result) {
			ring.push(result);
			if (ring.length > ringSize) {
				ring.shift();
			}
		},
		getRecentToolResults() {
			return ring;
		},
	};
}
