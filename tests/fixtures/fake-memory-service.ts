import { vi } from "vitest";
import type { MemoryService } from "../../src/memory-service";
import type { MemoryEntryView } from "../../src/types";

export function createFakeEntry(overrides: Partial<MemoryEntryView> = {}): MemoryEntryView {
	return {
		id: "fake-1",
		layer: "episodic",
		content: "fake content",
		tags: [],
		strength: 0.5,
		halfLifeDays: 7,
		confidence: "observed",
		emotionalValence: "neutral",
		pinned: false,
		retrievalCount: 0,
		createdAt: "2026-04-09T00:00:00.000Z",
		lastRetrievedAt: "2026-04-09T00:00:00.000Z",
		root: "project",
		...overrides,
	};
}

export function createFakeService(): MemoryService {
	const fake = {
		init: vi.fn().mockResolvedValue({
			projectRoot: "/tmp/fake-project",
			globalRoot: "/tmp/fake-global",
			searchMode: "hybrid",
			migratedVersions: { project: 8, global: 8 },
		}),
		shutdown: vi.fn().mockResolvedValue(undefined),
		isReady: vi.fn().mockReturnValue(true),

		remember: vi.fn().mockResolvedValue(createFakeEntry()),
		captureError: vi.fn().mockResolvedValue(createFakeEntry({ tags: ["error"] })),
		decide: vi.fn().mockResolvedValue(createFakeEntry({ confidence: "verified" })),

		recall: vi.fn().mockResolvedValue({
			query: "",
			results: [],
			tokensUsed: 0,
			mode: "hybrid",
		}),
		context: vi.fn().mockResolvedValue({
			ids: [],
			summary: "",
			formattedBlock: "",
			framing: "observe",
			tokensUsed: 0,
		}),
		inspect: vi.fn().mockResolvedValue(null),
		listConflicts: vi.fn().mockResolvedValue([]),

		outcome: vi.fn().mockResolvedValue(undefined),
		pin: vi.fn().mockResolvedValue(undefined),
		forget: vi.fn().mockResolvedValue(undefined),
		invalidate: vi.fn().mockResolvedValue(0),
		resolveConflict: vi.fn().mockResolvedValue(undefined),

		sleep: vi.fn().mockResolvedValue({
			decayed: 0,
			merged: 0,
			conflicts: 0,
			promoted: 0,
			durationMs: 0,
		}),

		wmPush: vi.fn().mockResolvedValue(undefined),
		wmRead: vi.fn().mockResolvedValue([]),
		wmFlush: vi.fn().mockResolvedValue(undefined),

		share: vi.fn().mockResolvedValue({ promoted: [], skipped: [], dryRun: false }),
		autoShare: vi.fn().mockResolvedValue({ promoted: 0, considered: 0 }),

		learnFromGit: vi.fn().mockResolvedValue({ scanned: 0, added: 0, skipped: 0 }),

		status: vi.fn().mockResolvedValue({
			projectTotal: 0,
			globalTotal: 0,
			episodic: 0,
			semantic: 0,
			buffer: 0,
			averageStrength: 0,
			newSinceLastSleep: 0,
			lastSleepAt: null,
			searchMode: "hybrid",
		}),
	};
	return fake as MemoryService;
}
