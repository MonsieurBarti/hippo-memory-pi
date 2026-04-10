export type SuccessAssessment = "good" | "bad" | "ambiguous";

export interface ToolResultSummary {
	isError: boolean;
}

export interface AssessInput {
	stopReason: string;
	recentToolResults: ToolResultSummary[];
}

export class SuccessDetector {
	assess(input: AssessInput): SuccessAssessment {
		if (input.stopReason === "error" || input.stopReason === "aborted") return "bad";
		if (input.stopReason !== "stop") return "ambiguous";
		const recentWindow = input.recentToolResults.slice(-3);
		const anyRecentError = recentWindow.some((r) => r.isError === true);
		return anyRecentError ? "bad" : "good";
	}
}
