import { mkdirSync } from "node:fs";
import { initStore } from "hippo-memory";
import type { HippoMemoryConfig } from "./config";
import type { MemoryService } from "./memory-service";
import { Mutex } from "./mutex";
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
	MemoryRoot,
	MemoryStatus,
	RecallOptions,
	RecallResult,
	RememberInput,
	ShareResult,
	WorkingMemoryItem,
} from "./types";

export class HippoMemoryService implements MemoryService {
	protected readonly config: HippoMemoryConfig;
	protected readonly writeMutex = new Mutex();
	private ready = false;
	private projectRoot: string | null = null;
	private globalRoot: string | null = null;

	constructor(config: HippoMemoryConfig) {
		this.config = config;
	}

	async init(_cwd: string): Promise<InitResult> {
		if (!this.config.projectRoot || !this.config.globalRoot) {
			throw new Error("projectRoot and globalRoot must be resolved before HippoMemoryService.init");
		}

		// Project root: hard failure if we can't open it.
		this.projectRoot = this.config.projectRoot;
		mkdirSync(this.projectRoot, { recursive: true });
		await initStore(this.projectRoot);

		// Global root: soft failure — if we can't write to it (permissions,
		// read-only volume, etc.) we fall back to project-only mode instead
		// of blocking the whole extension.
		try {
			mkdirSync(this.config.globalRoot, { recursive: true });
			await initStore(this.config.globalRoot);
			this.globalRoot = this.config.globalRoot;
		} catch {
			this.globalRoot = null;
		}

		this.ready = true;
		return {
			projectRoot: this.projectRoot,
			globalRoot: this.globalRoot,
			searchMode: this.config.searchMode,
			migratedVersions: { project: 0, global: this.globalRoot ? 0 : null },
		};
	}

	async shutdown(): Promise<void> {
		this.ready = false;
		this.projectRoot = null;
		this.globalRoot = null;
	}

	isReady(): boolean {
		return this.ready;
	}

	// ---------- Unimplemented methods (bodies filled in Waves 2.C / 2.D) ----------

	async remember(_input: RememberInput): Promise<MemoryEntryView> {
		throw new Error("not implemented");
	}
	async captureError(_input: ErrorCaptureInput): Promise<MemoryEntryView | null> {
		throw new Error("not implemented");
	}
	async decide(_input: DecideInput): Promise<MemoryEntryView> {
		throw new Error("not implemented");
	}
	async recall(_query: string, _opts?: RecallOptions): Promise<RecallResult> {
		throw new Error("not implemented");
	}
	async context(_opts?: ContextOptions): Promise<ContextResult> {
		throw new Error("not implemented");
	}
	async inspect(_id: string): Promise<MemoryEntryView | null> {
		throw new Error("not implemented");
	}
	async listConflicts(_status?: "open" | "resolved" | "all"): Promise<MemoryConflictView[]> {
		throw new Error("not implemented");
	}
	async outcome(_id: string, _result: "good" | "bad"): Promise<void> {
		throw new Error("not implemented");
	}
	async pin(_id: string, _pinned: boolean): Promise<void> {
		throw new Error("not implemented");
	}
	async forget(_id: string): Promise<void> {
		throw new Error("not implemented");
	}
	async invalidate(_pattern: string, _reason?: string): Promise<number> {
		throw new Error("not implemented");
	}
	async resolveConflict(_conflictId: string, _keep: "first" | "second"): Promise<void> {
		throw new Error("not implemented");
	}
	async sleep(_opts?: { dryRun?: boolean }): Promise<ConsolidationResult> {
		throw new Error("not implemented");
	}
	async wmPush(_item: WorkingMemoryItem): Promise<void> {
		throw new Error("not implemented");
	}
	async wmRead(_scope: string): Promise<WorkingMemoryItem[]> {
		throw new Error("not implemented");
	}
	async wmFlush(): Promise<void> {
		throw new Error("not implemented");
	}
	async share(_idOrAuto: string | "auto", _dryRun?: boolean): Promise<ShareResult> {
		throw new Error("not implemented");
	}
	async autoShare(): Promise<AutoShareResult> {
		throw new Error("not implemented");
	}
	async learnFromGit(_opts?: { days?: number; repos?: string[] }): Promise<LearnResult> {
		throw new Error("not implemented");
	}
	async status(): Promise<MemoryStatus> {
		throw new Error("not implemented");
	}

	// ---------- Protected helpers for subclass methods in 2.C/2.D ----------

	protected requireProjectRoot(): string {
		if (!this.projectRoot) throw new Error("hippo memory service not initialized");
		return this.projectRoot;
	}

	protected getGlobalRoot(): string | null {
		return this.globalRoot;
	}

	/** Annotation helper so later waves can mark entries as project vs global without duplicating the logic. */
	protected rootOf(entryRoot: MemoryRoot): string {
		if (entryRoot === "global") {
			const g = this.getGlobalRoot();
			if (!g) throw new Error("global store not available");
			return g;
		}
		return this.requireProjectRoot();
	}

	protected withWrite<T>(fn: () => Promise<T>): Promise<T> {
		return this.writeMutex.run(fn);
	}
}
