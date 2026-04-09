import { mkdirSync } from "node:fs";
import {
	createMemory,
	explainMatch,
	hybridSearch,
	initStore,
	listMemoryConflicts,
	loadAllEntries,
	markRetrieved,
	readEntry,
	search,
	writeEntry,
} from "hippo-memory";
import type { HippoMemoryConfig } from "./config";
import type { MemoryService } from "./memory-service";
import { Mutex } from "./mutex";
import type {
	AutoShareResult,
	ConfidenceLevel,
	ConsolidationResult,
	ContextOptions,
	ContextResult,
	DecideInput,
	EmotionalValence,
	ErrorCaptureInput,
	InitResult,
	LearnResult,
	MemoryConflictView,
	MemoryEntryView,
	MemoryLayer,
	MemoryRoot,
	MemoryStatus,
	RecallHit,
	RecallOptions,
	RecallResult,
	RememberInput,
	ShareResult,
	WorkingMemoryItem,
} from "./types";

type HippoEntry = Record<string, unknown>;

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

	// ---------- Capture ----------

	async remember(input: RememberInput): Promise<MemoryEntryView> {
		const tags = [...(input.tags ?? [])];
		const isError = input.error === true;
		if (isError && !tags.includes("error")) {
			tags.push("error");
		}

		// Explicit override of hippo's "verified" default.
		const confidence: ConfidenceLevel = input.kind ?? "observed";

		const createOpts: Parameters<typeof createMemory>[1] = {
			tags,
			source: "pi:remember",
			confidence,
		};
		if (isError) {
			createOpts.emotional_valence = "negative";
			createOpts.baseHalfLifeDays = 14;
		}

		const useGlobal = input.global === true && this.getGlobalRoot() !== null;
		const root: MemoryRoot = useGlobal ? "global" : "project";
		const hippoRoot = useGlobal ? (this.getGlobalRoot() as string) : this.requireProjectRoot();

		const entry = createMemory(input.content, createOpts) as unknown as HippoEntry;
		if (input.pin === true) {
			entry.pinned = true;
			entry.half_life_days = Number.POSITIVE_INFINITY;
		}

		await this.withWrite(async () => {
			await writeEntry(hippoRoot, entry as never);
		});

		return this.toView(entry, root);
	}

	async captureError(input: ErrorCaptureInput): Promise<MemoryEntryView | null> {
		try {
			const tags = [...input.tags];
			if (!tags.includes("error")) tags.push("error");

			const entry = createMemory(input.content, {
				tags,
				source: input.source,
				confidence: "observed",
				emotional_valence: "negative",
				baseHalfLifeDays: 14,
			}) as unknown as HippoEntry;

			const hippoRoot = this.requireProjectRoot();
			await this.withWrite(async () => {
				await writeEntry(hippoRoot, entry as never);
			});
			return this.toView(entry, "project");
		} catch {
			// Error-logging path must not itself throw.
			return null;
		}
	}

	async decide(input: DecideInput): Promise<MemoryEntryView> {
		const content = input.context
			? `${input.decision}\n\nContext: ${input.context}`
			: input.decision;

		const entry = createMemory(content, {
			tags: ["decision"],
			source: "pi:decide",
			confidence: "verified",
			baseHalfLifeDays: 90,
		}) as unknown as HippoEntry;

		if (input.supersedes) {
			entry.conflicts_with = [input.supersedes];
		}

		const hippoRoot = this.requireProjectRoot();
		await this.withWrite(async () => {
			await writeEntry(hippoRoot, entry as never);
		});

		return this.toView(entry, "project");
	}

	// ---------- Retrieval ----------

	async recall(query: string, opts: RecallOptions = {}): Promise<RecallResult> {
		const project = this.requireProjectRoot();
		const globalRoot = this.getGlobalRoot();
		const budget = opts.budget ?? this.config.recallBudget;
		const limit = opts.limit ?? this.config.recallLimit;
		const scope = opts.scope ?? "both";
		const mode = this.config.searchMode;

		type RawHit = {
			entry: HippoEntry;
			score: number;
			bm25: number;
			cosine: number;
			root: MemoryRoot;
		};

		const runSearch = async (root: string, rootLabel: MemoryRoot): Promise<RawHit[]> => {
			const entries = (await loadAllEntries(root)) as unknown as HippoEntry[];
			const raw =
				mode === "hybrid"
					? await hybridSearch(query, entries as never, { budget })
					: search(query, entries as never, { budget });
			return (raw as unknown as Array<Record<string, unknown>>).map((h) => ({
				entry: h.entry as HippoEntry,
				score: (h.score as number) ?? 0,
				bm25: (h.bm25 as number) ?? 0,
				cosine: (h.cosine as number) ?? 0,
				root: rootLabel,
			}));
		};

		let hits: RawHit[] = [];
		if (scope === "global") {
			if (globalRoot) hits = await runSearch(globalRoot, "global");
		} else {
			hits = await runSearch(project, "project");
			if (scope === "both" && globalRoot) {
				hits.push(...(await runSearch(globalRoot, "global")));
			}
		}

		hits.sort((a, b) => b.score - a.score);
		hits = hits.slice(0, limit);

		// Retrieval side-effect: bump retrieval_count and last_retrieved.
		// markRetrieved returns NEW entries (it does not mutate in place
		// despite the .d.ts comment). Persist the returned copies via writeEntry.
		if (hits.length > 0) {
			await this.withWrite(async () => {
				const now = new Date();
				const byRoot = new Map<string, HippoEntry[]>();
				for (const h of hits) {
					const r = h.root === "global" ? (globalRoot as string) : project;
					const arr = byRoot.get(r) ?? [];
					arr.push(h.entry);
					byRoot.set(r, arr);
				}
				for (const [root, entries] of byRoot) {
					const updated = markRetrieved(entries as never, now) as unknown as HippoEntry[];
					// Replace the `entry` reference on each hit with the updated copy
					// so toView sees the bumped retrieval_count/last_retrieved.
					for (let i = 0; i < updated.length; i++) {
						const before = entries[i];
						const after = updated[i];
						if (!after) continue;
						for (const h of hits) {
							if (h.entry === before) h.entry = after;
						}
						try {
							await writeEntry(root, after as never);
						} catch {
							// best-effort: don't fail recall if the write-back fails
						}
					}
				}
			});
		}

		// Build RecallResult
		const results: RecallHit[] = hits.map((h) => {
			const view = this.toView(h.entry, h.root);
			const base: RecallHit = { entry: view, score: h.score };
			if (opts.why) {
				try {
					const explanation = explainMatch(query, {
						entry: h.entry,
						score: h.score,
						bm25: h.bm25,
						cosine: h.cosine,
						tokens: Math.ceil((view.content.length ?? 0) / 4),
					} as never);
					const reason =
						typeof explanation === "string"
							? explanation
							: ((explanation as { reason?: string } | null)?.reason ?? "");
					if (reason) base.explanation = reason;
				} catch {
					// explanation is optional; swallow errors
				}
			}
			return base;
		});

		const tokensUsed = results.reduce((acc, r) => acc + Math.ceil(r.entry.content.length / 4), 0);

		return { query, results, tokensUsed, mode };
	}

	async context(opts: ContextOptions = {}): Promise<ContextResult> {
		const query = opts.query ?? "";
		const framing = opts.framing ?? this.config.framing;

		if (!query) {
			return { ids: [], summary: "", formattedBlock: "", framing, tokensUsed: 0 };
		}

		const recallOpts: RecallOptions = {
			budget: opts.budget ?? this.config.recallBudget,
			limit: opts.limit ?? this.config.recallLimit,
			scope: opts.scope ?? "both",
		};
		const recall = await this.recall(query, recallOpts);

		if (recall.results.length === 0) {
			return { ids: [], summary: "", formattedBlock: "", framing, tokensUsed: 0 };
		}

		const formattedBlock = this.formatContextBlock(recall, framing);
		const summary = `Retrieved ${recall.results.length} memories (~${recall.tokensUsed} tokens)`;

		return {
			ids: recall.results.map((r) => r.entry.id),
			summary,
			formattedBlock,
			framing,
			tokensUsed: recall.tokensUsed,
		};
	}

	async inspect(id: string): Promise<MemoryEntryView | null> {
		const project = this.requireProjectRoot();
		const globalRoot = this.getGlobalRoot();

		try {
			const local = (await readEntry(project, id)) as unknown as HippoEntry | null;
			if (local) return this.toView(local, "project");
		} catch {
			// fall through to global
		}

		if (globalRoot) {
			try {
				const global = (await readEntry(globalRoot, id)) as unknown as HippoEntry | null;
				if (global) return this.toView(global, "global");
			} catch {
				// fall through
			}
		}

		return null;
	}

	async listConflicts(status: "open" | "resolved" | "all" = "open"): Promise<MemoryConflictView[]> {
		const rows = (await listMemoryConflicts(
			this.requireProjectRoot(),
			status as never,
		)) as unknown as Array<Record<string, unknown>>;

		return rows.map((row) => {
			const rawId = row.id;
			const id = typeof rawId === "number" ? String(rawId) : ((rawId as string) ?? "");
			const first = (row.memory_a_id as string) ?? (row.first as string) ?? "";
			const second = (row.memory_b_id as string) ?? (row.second as string) ?? "";
			const overlap = (row.score as number) ?? (row.overlap as number) ?? 0;
			const conflictType =
				(row.reason as string) ??
				(row.conflict_type as string) ??
				(row.conflictType as string) ??
				"unknown";
			const rowStatus = (row.status as "open" | "resolved") ?? "open";
			const detectedAt = (row.detected_at as string) ?? (row.detectedAt as string) ?? "";
			return {
				id,
				first,
				second,
				overlap,
				conflictType,
				status: rowStatus,
				detectedAt,
			};
		});
	}

	// ---------- Unimplemented methods (bodies filled in Wave 2.D) ----------

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

	// ---------- Private helpers ----------

	private toView(entry: HippoEntry, root: MemoryRoot): MemoryEntryView {
		return {
			id: entry.id as string,
			layer: entry.layer as MemoryLayer,
			content: entry.content as string,
			tags: (entry.tags as string[] | undefined) ?? [],
			strength: entry.strength as number,
			halfLifeDays: entry.half_life_days as number,
			confidence: entry.confidence as ConfidenceLevel,
			emotionalValence: entry.emotional_valence as EmotionalValence,
			pinned: Boolean(entry.pinned),
			retrievalCount: (entry.retrieval_count as number | undefined) ?? 0,
			createdAt: entry.created as string,
			lastRetrievedAt: entry.last_retrieved as string,
			root,
		};
	}

	private formatContextBlock(
		recall: RecallResult,
		framing: "observe" | "suggest" | "assert",
	): string {
		const heading =
			framing === "observe"
				? "## Prior observations (hippo memory, observe framing)"
				: framing === "suggest"
					? "## Suggestions from prior work (hippo memory)"
					: "## Known facts (hippo memory, asserted)";

		const lines = recall.results.map((r) => {
			const date = r.entry.createdAt.slice(0, 10);
			const strength = r.entry.strength.toFixed(2);
			const tags = r.entry.tags.length > 0 ? `\n  tags: [${r.entry.tags.join(", ")}]` : "";
			return `- [${date}, ${r.entry.confidence}, strength ${strength}] ${r.entry.content}${tags}`;
		});

		const footer = `\n\n(${recall.results.length} memories, ~${recall.tokensUsed} tokens; retrieved via ${recall.mode} search against "${recall.query}")`;

		return `${heading}\n\n${lines.join("\n")}${footer}`;
	}

	// ---------- Protected helpers for subclass methods ----------

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
