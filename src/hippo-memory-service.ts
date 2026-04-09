import { mkdirSync } from "node:fs";
import {
	applyOutcome,
	autoShare,
	consolidate,
	createMemory,
	deleteEntry,
	explainMatch,
	extractLessons,
	fetchGitLog,
	resolveConflict as hippoResolveConflict,
	hybridSearch,
	initStore,
	listMemoryConflicts,
	loadAllEntries,
	markRetrieved,
	promoteToGlobal,
	readEntry,
	search,
	wmFlush,
	wmPush,
	wmRead,
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

// Shape of a single row returned by hippo-memory's `listMemoryConflicts`.
// Verified against hippo@0.19.0 schema: the SQLite columns are
// `id INTEGER PRIMARY KEY`, `memory_a_id`, `memory_b_id`, `reason`, `score`,
// `status`, `detected_at`, `updated_at`. We only use a subset here.
interface HippoConflictRow {
	id: number;
	memory_a_id: string;
	memory_b_id: string;
	reason: string;
	score: number;
	status: "open" | "resolved";
	detected_at: string;
}

export class HippoMemoryService implements MemoryService {
	protected readonly config: HippoMemoryConfig;
	protected readonly writeMutex = new Mutex();
	private ready = false;
	private projectRoot: string | null = null;
	private globalRoot: string | null = null;
	// Process-local counters used by the auto-sleep hook (Wave 5). hippo does
	// not expose a cheap "memories created since last consolidation" metric, so
	// we track it in-process: reset to 0 on sleep(), incremented by every
	// capture path. lastSleepAt is also process-local; it resets on service
	// init and gets set by sleep(). Consequence: across distinct sessions the
	// counter starts at 0 again — acceptable because session_start will not
	// have auto-sleep racing against incomplete writes.
	private newMemoriesCount = 0;
	private lastSleepAt: string | null = null;

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
		this.newMemoriesCount = 0;
		this.lastSleepAt = null;
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
		this.newMemoriesCount = 0;
		this.lastSleepAt = null;
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
		this.newMemoriesCount++;

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
			this.newMemoriesCount++;
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
		this.newMemoriesCount++;

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
		// hippo's `listMemoryConflicts` filters via `WHERE status = ?`, so the
		// "all" sentinel returns zero rows. Callers that want both buckets must
		// call this method twice. The interface still accepts "all" for
		// forward-compat if hippo adds proper handling later.
		const rows = (await listMemoryConflicts(
			this.requireProjectRoot(),
			status as never,
		)) as unknown as Array<HippoConflictRow>;

		return rows.map((row) => ({
			id: String(row.id),
			first: row.memory_a_id,
			second: row.memory_b_id,
			overlap: row.score,
			conflictType: row.reason,
			status: row.status,
			detectedAt: row.detected_at,
		}));
	}

	// ---------- Mutation ----------

	async outcome(id: string, result: "good" | "bad"): Promise<void> {
		await this.withWrite(async () => {
			const root = await this.findRootContaining(id);
			if (!root) return;
			const entry = (await readEntry(root, id)) as unknown as HippoEntry | null;
			if (!entry) return;
			// applyOutcome returns a NEW entry, does not mutate in place.
			const updated = applyOutcome(entry as never, result === "good") as unknown as HippoEntry;
			await writeEntry(root, updated as never);
		});
	}

	async pin(id: string, pinned: boolean): Promise<void> {
		await this.withWrite(async () => {
			const root = await this.findRootContaining(id);
			if (!root) return;
			const entry = (await readEntry(root, id)) as unknown as HippoEntry | null;
			if (!entry) return;
			entry.pinned = pinned;
			if (pinned) {
				entry.half_life_days = Number.POSITIVE_INFINITY;
			}
			await writeEntry(root, entry as never);
		});
	}

	async forget(id: string): Promise<void> {
		await this.withWrite(async () => {
			const root = await this.findRootContaining(id);
			if (!root) return;
			deleteEntry(root, id);
		});
	}

	async invalidate(pattern: string, reason?: string): Promise<number> {
		return this.withWrite(async () => {
			const project = this.requireProjectRoot();
			const all = (await loadAllEntries(project)) as unknown as HippoEntry[];
			const lower = pattern.toLowerCase();
			const cap = 1000;
			let weakened = 0;
			for (const entry of all) {
				if (weakened >= cap) break;
				const content = String(entry.content ?? "").toLowerCase();
				const tagsText = ((entry.tags as string[] | undefined) ?? []).join(" ").toLowerCase();
				if (content.includes(lower) || tagsText.includes(lower)) {
					entry.strength = Math.max(0, (entry.strength as number) * 0.25);
					entry.half_life_days = Math.max(0.5, (entry.half_life_days as number) * 0.5);
					if (reason) {
						const existing = (entry.tags as string[] | undefined) ?? [];
						entry.tags = [...existing, `invalidated:${reason}`];
					}
					await writeEntry(project, entry as never);
					weakened++;
				}
			}
			return weakened;
		});
	}

	async resolveConflict(conflictId: string, keep: "first" | "second"): Promise<void> {
		await this.withWrite(async () => {
			const root = this.requireProjectRoot();
			// hippo's listMemoryConflicts only filters by exact status; "open" is the
			// default and the only case we need to resolve from.
			const conflicts = await this.listConflicts("open");
			const target = conflicts.find((c) => c.id === conflictId);
			if (!target) throw new Error(`conflict ${conflictId} not found`);
			const keepId = keep === "first" ? target.first : target.second;
			if (!keepId) throw new Error(`conflict ${conflictId} has no ${keep} entry`);
			// hippo accepts either string or number for conflictId via SQLite coercion.
			hippoResolveConflict(root, conflictId as never, keepId, true);
		});
	}

	// ---------- Consolidation + status ----------

	async sleep(opts: { dryRun?: boolean } = {}): Promise<ConsolidationResult> {
		const started = Date.now();
		const project = this.requireProjectRoot();

		const raw = (await this.withWrite(async () => {
			return consolidate(project, { dryRun: opts.dryRun === true });
		})) as unknown as Record<string, unknown>;

		let promoted = 0;
		// Only run autoShare on real (non-dry) sleep cycles, and only when the
		// config enables it and a global store is available.
		if (opts.dryRun !== true && this.config.autoShare && this.getGlobalRoot() !== null) {
			try {
				const shareResult = await this.withWrite(async () => autoShare(project, { dryRun: false }));
				promoted = Array.isArray(shareResult) ? (shareResult as unknown[]).length : 0;
			} catch {
				// best-effort
			}
		}

		// Reset the session-local counter on real sleep cycles. dryRun is a
		// preview and must not perturb state that downstream hooks depend on.
		if (opts.dryRun !== true) {
			this.newMemoriesCount = 0;
			this.lastSleepAt = new Date().toISOString();
		}

		return {
			decayed: (raw.decayed as number | undefined) ?? 0,
			merged: (raw.merged as number | undefined) ?? 0,
			conflicts: 0,
			promoted,
			durationMs: Date.now() - started,
		};
	}

	async status(): Promise<MemoryStatus> {
		const project = this.requireProjectRoot();
		const globalRoot = this.getGlobalRoot();
		const projectEntries = (await loadAllEntries(project)) as unknown as HippoEntry[];
		const globalEntries = globalRoot
			? ((await loadAllEntries(globalRoot)) as unknown as HippoEntry[])
			: [];

		const episodic = projectEntries.filter((e) => e.layer === "episodic").length;
		const semantic = projectEntries.filter((e) => e.layer === "semantic").length;
		const buffer = projectEntries.filter((e) => e.layer === "buffer").length;
		const averageStrength =
			projectEntries.length > 0
				? projectEntries.reduce((acc, e) => acc + ((e.strength as number | undefined) ?? 0), 0) /
					projectEntries.length
				: 0;

		return {
			projectTotal: projectEntries.length,
			globalTotal: globalEntries.length,
			episodic,
			semantic,
			buffer,
			averageStrength,
			newSinceLastSleep: this.newMemoriesCount,
			lastSleepAt: this.lastSleepAt,
			searchMode: this.config.searchMode,
		};
	}

	// ---------- Working memory ----------

	async wmPush(item: WorkingMemoryItem): Promise<void> {
		await this.withWrite(async () => {
			wmPush(this.requireProjectRoot(), {
				scope: item.scope,
				content: item.content,
				importance: item.importance ?? 1,
			});
		});
	}

	async wmRead(scope: string): Promise<WorkingMemoryItem[]> {
		const rows = wmRead(this.requireProjectRoot(), { scope }) as unknown as Array<
			Record<string, unknown>
		>;
		return rows.map((row) => ({
			scope: row.scope as string,
			content: row.content as string,
			importance: (row.importance as number | undefined) ?? 1,
		}));
	}

	async wmFlush(): Promise<void> {
		await this.withWrite(async () => {
			wmFlush(this.requireProjectRoot(), {});
		});
	}

	// ---------- Global store — share + autoShare ----------

	async share(idOrAuto: string | "auto", dryRun = false): Promise<ShareResult> {
		const project = this.requireProjectRoot();
		const globalRoot = this.getGlobalRoot();
		if (!globalRoot) {
			return { promoted: [], skipped: [], dryRun };
		}

		if (idOrAuto === "auto") {
			try {
				const result = (await this.withWrite(async () =>
					autoShare(project, { dryRun }),
				)) as unknown;
				// hippo's autoShare returns an array (candidates on dryRun, shared on real run).
				const items = Array.isArray(result) ? (result as Array<Record<string, unknown>>) : [];
				const promoted = items
					.map((e) => e.id as string | undefined)
					.filter((id): id is string => typeof id === "string");
				return { promoted, skipped: [], dryRun };
			} catch {
				return { promoted: [], skipped: [], dryRun };
			}
		}

		// Single id promotion
		if (dryRun) {
			return { promoted: [idOrAuto], skipped: [], dryRun };
		}
		try {
			await this.withWrite(async () => promoteToGlobal(project, idOrAuto));
			return { promoted: [idOrAuto], skipped: [], dryRun };
		} catch {
			return { promoted: [], skipped: [idOrAuto], dryRun };
		}
	}

	async autoShare(): Promise<AutoShareResult> {
		const globalRoot = this.getGlobalRoot();
		if (!globalRoot) return { promoted: 0, considered: 0 };
		try {
			const result = (await this.withWrite(async () =>
				autoShare(this.requireProjectRoot(), {}),
			)) as unknown;
			const promoted = Array.isArray(result) ? (result as unknown[]).length : 0;
			// hippo's autoShare only returns the promoted array; we can't know the
			// "considered" count without re-running the filter ourselves. Report
			// promoted as both values for v1.
			return { promoted, considered: promoted };
		} catch {
			return { promoted: 0, considered: 0 };
		}
	}

	// ---------- Git learn ----------

	async learnFromGit(opts: { days?: number; repos?: string[] } = {}): Promise<LearnResult> {
		const days = opts.days ?? 30;
		const repos = opts.repos ?? [process.cwd()];

		try {
			let combinedLog = "";
			for (const repo of repos) {
				try {
					// hippo's fetchGitLog returns a raw newline-separated string
					// (or "" on failure — it swallows errors internally).
					const log = (await fetchGitLog(repo, days)) as unknown as string;
					if (typeof log === "string" && log.length > 0) {
						combinedLog = combinedLog.length > 0 ? `${combinedLog}\n${log}` : log;
					}
				} catch {
					// skip repos where git failed
				}
			}

			const scanned =
				combinedLog.length > 0 ? combinedLog.split("\n").filter((l) => l.length > 0).length : 0;

			if (scanned === 0) {
				return { scanned: 0, added: 0, skipped: 0 };
			}

			// hippo's extractLessons returns an array of strings, not objects.
			const lessons = (extractLessons(combinedLog as never) as unknown as unknown[]) ?? [];
			let added = 0;
			for (const lesson of lessons) {
				try {
					const content = typeof lesson === "string" ? lesson : String(lesson ?? "");
					if (!content) continue;
					await this.remember({
						content,
						tags: ["git-learn"],
					});
					added++;
				} catch {
					// silent per-lesson failure
				}
			}

			return {
				scanned,
				added,
				skipped: Math.max(0, lessons.length - added),
			};
		} catch {
			return { scanned: 0, added: 0, skipped: 0 };
		}
	}

	// ---------- Private helpers ----------

	private async findRootContaining(id: string): Promise<string | null> {
		const project = this.requireProjectRoot();
		const globalRoot = this.getGlobalRoot();
		try {
			if (await readEntry(project, id)) return project;
		} catch {
			// fall through
		}
		if (globalRoot) {
			try {
				if (await readEntry(globalRoot, id)) return globalRoot;
			} catch {
				// fall through
			}
		}
		return null;
	}

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
