import type {
	AutoShareResult,
	ConsolidationResult,
	ContextOptions,
	ContextResult,
	DecideInput,
	ErrorCaptureInput,
	InitResult,
	LearnResult,
	MemoryConflictView,
	MemoryEntryView,
	MemoryStatus,
	RecallOptions,
	RecallResult,
	RememberInput,
	ShareResult,
	WorkingMemoryItem,
} from "./types";

export interface MemoryService {
	// Lifecycle
	init(cwd: string): Promise<InitResult>;
	shutdown(): Promise<void>;
	isReady(): boolean;

	// Capture
	remember(input: RememberInput): Promise<MemoryEntryView>;
	captureError(input: ErrorCaptureInput): Promise<MemoryEntryView | null>;
	decide(input: DecideInput): Promise<MemoryEntryView>;

	// Retrieval
	recall(query: string, opts?: RecallOptions): Promise<RecallResult>;
	context(opts?: ContextOptions): Promise<ContextResult>;
	inspect(id: string): Promise<MemoryEntryView | null>;
	listConflicts(status?: "open" | "resolved" | "all"): Promise<MemoryConflictView[]>;

	// Mutation
	outcome(id: string, result: "good" | "bad"): Promise<void>;
	pin(id: string, pinned: boolean): Promise<void>;
	forget(id: string): Promise<void>;
	invalidate(pattern: string, reason?: string): Promise<number>;
	// IMPORTANT: keep is "first" | "second" only — we dropped "both" and
	// "neither" from v1 because hippo-memory's native resolveConflict takes
	// an entry id, not an enum, and mapping those extra cases needs design.
	resolveConflict(conflictId: string, keep: "first" | "second"): Promise<void>;

	// Consolidation
	sleep(opts?: { dryRun?: boolean }): Promise<ConsolidationResult>;

	// Working memory
	wmPush(item: WorkingMemoryItem): Promise<void>;
	wmRead(scope: string): Promise<WorkingMemoryItem[]>;
	wmFlush(): Promise<void>;

	// Global store
	share(idOrAuto: string | "auto", dryRun?: boolean): Promise<ShareResult>;
	autoShare(): Promise<AutoShareResult>;

	// Git learn
	learnFromGit(opts?: { days?: number; repos?: string[] }): Promise<LearnResult>;

	// Status
	status(): Promise<MemoryStatus>;
}
