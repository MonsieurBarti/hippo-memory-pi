import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import {
	type ConsolidationResult as HippoConsolidationResult,
	type WorkingMemoryItem as HippoWorkingMemoryItem,
	Layer,
	type MatchExplanation,
	type MemoryEntry,
	type SearchResult,
	applyOutcome,
	autoShare,
	consolidate,
	createMemory,
	deleteEntry,
	explainMatch,
	extractLessons,
	fetchGitLog,
	resolveConflict as hippoResolveConflict,
	wmPush as hippoWmPush,
	wmRead as hippoWmRead,
	hybridSearch,
	initStore,
	listMemoryConflicts,
	loadAllEntries,
	markRetrieved,
	promoteToGlobal,
	readEntry,
	search,
	wmFlush,
	writeEntry,
} from "hippo-memory";

/**
 * Shape of a single row returned by `listMemoryConflicts`. hippo-memory
 * defines this type in its internal store module but does not re-export it
 * from the package root, so we mirror the relevant subset here. Verified
 * against hippo@0.19.0's `MemoryConflict` interface.
 */
interface HippoConflictRow {
	id: number;
	memory_a_id: string;
	memory_b_id: string;
	reason: string;
	score: number;
	status: string;
	detected_at: string;
	updated_at: string;
}
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

/**
 * Convert hippo's `Layer` enum value (runtime: string "buffer"/"episodic"/
 * "semantic") to our domain-facing `MemoryLayer` literal union. A switch is
 * used instead of a cast so TypeScript verifies the mapping exhaustively.
 */
function layerToDomain(layer: Layer): MemoryLayer {
	switch (layer) {
		case Layer.Buffer:
			return "buffer";
		case Layer.Episodic:
			return "episodic";
		case Layer.Semantic:
			return "semantic";
	}
}

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
		initStore(this.projectRoot);

		// Global root: soft failure — if we can't write to it (permissions,
		// read-only volume, etc.) we fall back to project-only mode instead
		// of blocking the whole extension.
		try {
			mkdirSync(this.config.globalRoot, { recursive: true });
			initStore(this.config.globalRoot);
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

		// Explicit override of hippo's "verified" default for plain observations.
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
		// useGlobal already checked getGlobalRoot() !== null so the non-null
		// assertion below is safe but we avoid `!` by re-reading and falling
		// back to project if somehow racy.
		const globalRoot = this.getGlobalRoot();
		const hippoRoot = useGlobal && globalRoot ? globalRoot : this.requireProjectRoot();

		const entry = createMemory(input.content, createOpts);
		if (input.pin === true) {
			entry.pinned = true;
			entry.half_life_days = Number.POSITIVE_INFINITY;
		}

		await this.withWrite(async () => {
			writeEntry(hippoRoot, entry);
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
			});

			const hippoRoot = this.requireProjectRoot();
			await this.withWrite(async () => {
				writeEntry(hippoRoot, entry);
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
		});

		if (input.supersedes) {
			entry.conflicts_with = [input.supersedes];
		}

		const hippoRoot = this.requireProjectRoot();
		await this.withWrite(async () => {
			writeEntry(hippoRoot, entry);
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

		interface RawHit {
			result: SearchResult;
			root: MemoryRoot;
		}

		const runSearch = async (root: string, rootLabel: MemoryRoot): Promise<RawHit[]> => {
			const entries = loadAllEntries(root);
			const raw =
				mode === "hybrid"
					? await hybridSearch(query, entries, { budget })
					: search(query, entries, { budget });
			return raw.map((result) => ({ result, root: rootLabel }));
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

		hits.sort((a, b) => b.result.score - a.result.score);
		hits = hits.slice(0, limit);

		// Retrieval side-effect: bump retrieval_count and last_retrieved.
		// markRetrieved returns NEW entries (does not mutate in place despite
		// the .d.ts description). Persist the returned copies via writeEntry.
		if (hits.length > 0) {
			await this.withWrite(async () => {
				const now = new Date();
				const byRoot = new Map<string, { entries: MemoryEntry[]; indexes: number[] }>();
				hits.forEach((h, i) => {
					const r = h.root === "global" && globalRoot ? globalRoot : project;
					const bucket = byRoot.get(r) ?? { entries: [], indexes: [] };
					bucket.entries.push(h.result.entry);
					bucket.indexes.push(i);
					byRoot.set(r, bucket);
				});
				for (const [root, { entries, indexes }] of byRoot) {
					const updated = markRetrieved(entries, now);
					for (let j = 0; j < updated.length; j++) {
						const after = updated[j];
						const hitIndex = indexes[j];
						if (!after || hitIndex === undefined) continue;
						const hit = hits[hitIndex];
						if (hit) hit.result = { ...hit.result, entry: after };
						try {
							writeEntry(root, after);
						} catch {
							// best-effort: don't fail recall if the write-back fails
						}
					}
				}
			});
		}

		// Build RecallResult
		const results: RecallHit[] = hits.map((h) => {
			const view = this.toView(h.result.entry, h.root);
			const base: RecallHit = { entry: view, score: h.result.score };
			if (opts.why) {
				try {
					const explanation: MatchExplanation = explainMatch(query, h.result);
					if (explanation.reason) base.explanation = explanation.reason;
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
			const local = readEntry(project, id);
			if (local) return this.toView(local, "project");
		} catch {
			// fall through to global
		}

		if (globalRoot) {
			try {
				const global = readEntry(globalRoot, id);
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
		const rows: HippoConflictRow[] = listMemoryConflicts(this.requireProjectRoot(), status);

		return rows.map((row) => ({
			id: String(row.id),
			first: row.memory_a_id,
			second: row.memory_b_id,
			overlap: row.score,
			conflictType: row.reason,
			// hippo's MemoryConflict.status is typed `string`, but the schema
			// only stores "open" or "resolved". Narrow explicitly.
			status: row.status === "resolved" ? "resolved" : "open",
			detectedAt: row.detected_at,
		}));
	}

	// ---------- Mutation ----------

	async outcome(id: string, result: "good" | "bad"): Promise<void> {
		await this.withWrite(async () => {
			const root = await this.findRootContaining(id);
			if (!root) return;
			const entry = readEntry(root, id);
			if (!entry) return;
			// applyOutcome returns a NEW entry, does not mutate in place.
			const updated = applyOutcome(entry, result === "good");
			writeEntry(root, updated);
		});
	}

	async pin(id: string, pinned: boolean): Promise<void> {
		await this.withWrite(async () => {
			const root = await this.findRootContaining(id);
			if (!root) return;
			const entry = readEntry(root, id);
			if (!entry) return;
			entry.pinned = pinned;
			if (pinned) {
				entry.half_life_days = Number.POSITIVE_INFINITY;
			}
			writeEntry(root, entry);
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
			const all: MemoryEntry[] = loadAllEntries(project);
			const lower = pattern.toLowerCase();
			const cap = 1000;
			let weakened = 0;
			for (const entry of all) {
				if (weakened >= cap) break;
				const content = entry.content.toLowerCase();
				const tagsText = entry.tags.join(" ").toLowerCase();
				if (content.includes(lower) || tagsText.includes(lower)) {
					entry.strength = Math.max(0, entry.strength * 0.25);
					entry.half_life_days = Math.max(0.5, entry.half_life_days * 0.5);
					if (reason) {
						entry.tags = [...entry.tags, `invalidated:${reason}`];
					}
					writeEntry(project, entry);
					weakened++;
				}
			}
			return weakened;
		});
	}

	async resolveConflict(conflictId: string, keep: "first" | "second"): Promise<void> {
		await this.withWrite(async () => {
			const root = this.requireProjectRoot();
			// hippo's listMemoryConflicts only returns open conflicts when the
			// status is "open"; that's all we can resolve from.
			const conflicts = await this.listConflicts("open");
			const target = conflicts.find((c) => c.id === conflictId);
			if (!target) throw new Error(`conflict ${conflictId} not found`);
			const keepId = keep === "first" ? target.first : target.second;
			if (!keepId) throw new Error(`conflict ${conflictId} has no ${keep} entry`);
			// hippo stores the row id as a number; parse it back.
			const numericId = Number.parseInt(conflictId, 10);
			if (!Number.isFinite(numericId)) {
				throw new Error(`conflict id ${conflictId} is not numeric`);
			}
			hippoResolveConflict(root, numericId, keepId, true);
		});
	}

	// ---------- Consolidation + status ----------

	async sleep(opts: { dryRun?: boolean } = {}): Promise<ConsolidationResult> {
		const started = Date.now();
		const project = this.requireProjectRoot();

		const raw: HippoConsolidationResult = await this.withWrite(async () =>
			consolidate(project, { dryRun: opts.dryRun === true }),
		);

		let promoted = 0;
		// Only run autoShare on real (non-dry) sleep cycles, and only when the
		// config enables it and a global store is available.
		if (opts.dryRun !== true && this.config.autoShare && this.getGlobalRoot() !== null) {
			try {
				const shareResult: MemoryEntry[] = await this.withWrite(async () =>
					autoShare(project, { dryRun: false }),
				);
				promoted = shareResult.length;
			} catch {
				// best-effort
			}
		}

		return {
			decayed: raw.decayed,
			merged: raw.merged,
			conflicts: 0,
			promoted,
			durationMs: Date.now() - started,
		};
	}

	async status(): Promise<MemoryStatus> {
		const project = this.requireProjectRoot();
		const globalRoot = this.getGlobalRoot();
		const projectEntries: MemoryEntry[] = loadAllEntries(project);
		const globalEntries: MemoryEntry[] = globalRoot ? loadAllEntries(globalRoot) : [];

		const episodic = projectEntries.filter((e) => e.layer === Layer.Episodic).length;
		const semantic = projectEntries.filter((e) => e.layer === Layer.Semantic).length;
		const buffer = projectEntries.filter((e) => e.layer === Layer.Buffer).length;
		const averageStrength =
			projectEntries.length > 0
				? projectEntries.reduce((acc, e) => acc + e.strength, 0) / projectEntries.length
				: 0;

		// Read persistent sleep metrics from hippo's SQLite tables rather than
		// relying on in-process counters that reset between sessions.
		const { newSinceLastSleep, lastSleepAt } = this.loadSleepMetrics(project);

		return {
			projectTotal: projectEntries.length,
			globalTotal: globalEntries.length,
			episodic,
			semantic,
			buffer,
			averageStrength,
			newSinceLastSleep,
			lastSleepAt,
			searchMode: this.config.searchMode,
		};
	}

	// ---------- Working memory ----------

	async wmPush(item: WorkingMemoryItem): Promise<void> {
		await this.withWrite(async () => {
			hippoWmPush(this.requireProjectRoot(), {
				scope: item.scope,
				content: item.content,
				importance: item.importance ?? 1,
			});
		});
	}

	async wmRead(scope: string): Promise<WorkingMemoryItem[]> {
		const rows: HippoWorkingMemoryItem[] = hippoWmRead(this.requireProjectRoot(), { scope });
		return rows.map((row) => ({
			scope: row.scope,
			content: row.content,
			importance: row.importance,
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
				const result: MemoryEntry[] = await this.withWrite(async () =>
					autoShare(project, { dryRun }),
				);
				return { promoted: result.map((e) => e.id), skipped: [], dryRun };
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
			const result: MemoryEntry[] = await this.withWrite(async () =>
				autoShare(this.requireProjectRoot(), {}),
			);
			// hippo's autoShare only returns the promoted array; we can't know the
			// "considered" count without re-running the filter ourselves. Report
			// promoted as both values for v1.
			return { promoted: result.length, considered: result.length };
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
					const log: string = fetchGitLog(repo, days);
					if (log.length > 0) {
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
			const lessons: string[] = extractLessons(combinedLog);
			let added = 0;
			for (const content of lessons) {
				if (!content) continue;
				try {
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

	/**
	 * Read newSinceLastSleep and lastSleepAt from hippo's SQLite tables.
	 * Uses two read-only queries:
	 * - `MAX(timestamp) FROM consolidation_runs` → lastSleepAt
	 * - `COUNT(*) FROM memories WHERE created > lastSleepAt` → newSinceLastSleep
	 * Falls back to {0, null} on any error (e.g., DB not yet initialized).
	 */
	private loadSleepMetrics(projectRoot: string): {
		newSinceLastSleep: number;
		lastSleepAt: string | null;
	} {
		try {
			// Lazily require node:sqlite via createRequire so Vite/vitest doesn't
			// attempt to bundle it — the module is experimental (Node 22.5+) and
			// not on Vite's built-in list. hippo-memory itself loads it the same
			// way internally, so this is guaranteed to resolve at runtime.
			const nodeRequire = createRequire(import.meta.url);
			const { DatabaseSync } = nodeRequire("node:sqlite") as {
				DatabaseSync: new (
					path: string,
					options?: { open?: boolean },
				) => {
					prepare(sql: string): {
						get(...params: unknown[]): { [key: string]: unknown } | undefined;
					};
					close(): void;
				};
			};

			const dbPath = join(projectRoot, "hippo.db");
			const db = new DatabaseSync(dbPath, { open: true });

			// Last consolidation timestamp
			const lastRunRow = db.prepare("SELECT MAX(timestamp) as ts FROM consolidation_runs").get();
			const rawTs = lastRunRow?.ts;
			const lastSleepAt = typeof rawTs === "string" ? rawTs : null;

			// Count memories created since last sleep (or all if never slept)
			let newSinceLastSleep: number;
			if (lastSleepAt) {
				const countRow = db
					.prepare("SELECT COUNT(*) as cnt FROM memories WHERE created > ?")
					.get(lastSleepAt);
				const cnt = countRow?.cnt;
				newSinceLastSleep = typeof cnt === "number" ? cnt : 0;
			} else {
				const countRow = db.prepare("SELECT COUNT(*) as cnt FROM memories").get();
				const cnt = countRow?.cnt;
				newSinceLastSleep = typeof cnt === "number" ? cnt : 0;
			}

			db.close();
			return { newSinceLastSleep, lastSleepAt };
		} catch {
			return { newSinceLastSleep: 0, lastSleepAt: null };
		}
	}

	private async findRootContaining(id: string): Promise<string | null> {
		const project = this.requireProjectRoot();
		const globalRoot = this.getGlobalRoot();
		try {
			if (readEntry(project, id)) return project;
		} catch {
			// fall through
		}
		if (globalRoot) {
			try {
				if (readEntry(globalRoot, id)) return globalRoot;
			} catch {
				// fall through
			}
		}
		return null;
	}

	/**
	 * Map a hippo-memory MemoryEntry to our domain-facing MemoryEntryView.
	 * This is the ONLY boundary where hippo's internal shape meets our public
	 * types — every reader downstream uses MemoryEntryView exclusively.
	 *
	 * hippo's `EmotionalValence` and `ConfidenceLevel` are string literal
	 * unions identical to ours, so direct assignment is type-safe.
	 * `Layer` is a string enum, so we map it through `layerToDomain` to get a
	 * checked narrowing into our `MemoryLayer` union.
	 */
	private toView(entry: MemoryEntry, root: MemoryRoot): MemoryEntryView {
		const confidence: ConfidenceLevel = entry.confidence;
		const emotionalValence: EmotionalValence = entry.emotional_valence;
		return {
			id: entry.id,
			layer: layerToDomain(entry.layer),
			content: entry.content,
			tags: entry.tags,
			strength: entry.strength,
			halfLifeDays: entry.half_life_days,
			confidence,
			emotionalValence,
			pinned: entry.pinned,
			retrievalCount: entry.retrieval_count,
			createdAt: entry.created,
			lastRetrievedAt: entry.last_retrieved,
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
