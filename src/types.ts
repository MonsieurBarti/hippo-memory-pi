// Domain types shared across the extension. Kept separate from hippo-memory's
// own types so we can evolve the public surface independently of upstream churn.

export type MemoryLayer = "buffer" | "episodic" | "semantic";

export type EmotionalValence = "neutral" | "positive" | "negative" | "critical";

export type ConfidenceLevel = "verified" | "observed" | "inferred" | "stale";

export type MemoryRoot = "project" | "global";

export interface MemoryEntryView {
	id: string;
	layer: MemoryLayer;
	content: string;
	tags: string[];
	strength: number;
	halfLifeDays: number;
	confidence: ConfidenceLevel;
	emotionalValence: EmotionalValence;
	pinned: boolean;
	retrievalCount: number;
	createdAt: string;
	lastRetrievedAt: string;
	root: MemoryRoot;
}

export interface RememberInput {
	content: string;
	tags?: string[];
	kind?: Exclude<ConfidenceLevel, "stale">;
	error?: boolean;
	pin?: boolean;
	global?: boolean;
}

export interface ErrorCaptureInput {
	content: string;
	tags: string[];
	source: string;
}

export interface DecideInput {
	decision: string;
	context?: string;
	supersedes?: string;
}

export interface RecallOptions {
	budget?: number;
	limit?: number;
	why?: boolean;
	scope?: MemoryRoot | "both";
}

export interface RecallHit {
	entry: MemoryEntryView;
	score: number;
	explanation?: string;
}

export interface RecallResult {
	query: string;
	results: RecallHit[];
	tokensUsed: number;
	mode: "bm25" | "hybrid";
}

export interface ContextOptions {
	query?: string;
	budget?: number;
	limit?: number;
	framing?: "observe" | "suggest" | "assert";
	scope?: MemoryRoot | "both";
}

export interface ContextResult {
	ids: string[];
	summary: string;
	formattedBlock: string;
	framing: "observe" | "suggest" | "assert";
	tokensUsed: number;
}

export interface WorkingMemoryItem {
	scope: string;
	content: string;
	importance?: number;
}

export interface ConsolidationResult {
	decayed: number;
	merged: number;
	conflicts: number;
	promoted: number;
	durationMs: number;
}

export interface MemoryStatus {
	projectTotal: number;
	globalTotal: number;
	episodic: number;
	semantic: number;
	buffer: number;
	averageStrength: number;
	newSinceLastSleep: number;
	lastSleepAt: string | null;
	searchMode: "bm25" | "hybrid";
}

export interface MemoryConflictView {
	id: string;
	first: string;
	second: string;
	overlap: number;
	conflictType: string;
	status: "open" | "resolved";
	detectedAt: string;
}

export interface ShareResult {
	promoted: string[];
	skipped: string[];
	dryRun: boolean;
}

export interface AutoShareResult {
	promoted: number;
	considered: number;
}

export interface LearnResult {
	scanned: number;
	added: number;
	skipped: number;
}

export interface InitResult {
	projectRoot: string;
	globalRoot: string | null;
	searchMode: "bm25" | "hybrid";
	migratedVersions: { project: number; global: number | null };
}
