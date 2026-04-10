import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

// All 17 tff-memory tool names that must appear in the skill file.
// The skill references 15 in the allowed-tools frontmatter field (hot path),
// but the full set is enumerated here as a regression guard.
const ALLOWED_TOOLS_IN_FRONTMATTER = [
	"tff-memory_remember",
	"tff-memory_recall",
	"tff-memory_context",
	"tff-memory_decide",
	"tff-memory_outcome",
	"tff-memory_pin",
	"tff-memory_forget",
	"tff-memory_invalidate",
	"tff-memory_conflicts",
	"tff-memory_resolve",
	"tff-memory_inspect",
	"tff-memory_wm_push",
	"tff-memory_wm_read",
	"tff-memory_status",
	"tff-memory_share",
] as const;

describe("HIPPO_MEMORY skill file", () => {
	const skillPath = join(process.cwd(), "src", "skills", "hippo-memory", "SKILL.md");
	const content = readFileSync(skillPath, "utf8");

	test("file exists and is non-trivially sized", () => {
		expect(content.length).toBeGreaterThan(2000);
	});

	test("has required frontmatter fields", () => {
		expect(content).toMatch(/^---\nname: hippo-memory\b/);
		expect(content).toContain("description:");
		expect(content).toContain("version:");
		expect(content).toContain("allowed-tools:");
	});

	test("allowed-tools frontmatter lists every tff-memory_* tool", () => {
		const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
		expect(frontmatterMatch).not.toBeNull();
		const frontmatter = frontmatterMatch?.[1] ?? "";
		for (const tool of ALLOWED_TOOLS_IN_FRONTMATTER) {
			expect(frontmatter).toContain(tool);
		}
	});

	test("contains the Let: domain vocabulary block", () => {
		expect(content).toContain("## Let:");
		expect(content).toContain("μ");
		expect(content).toContain("s(m)");
		expect(content).toContain("h(m)");
	});

	test("contains the Axioms block with all 7 rules", () => {
		expect(content).toContain("## Axioms");
		for (const axiom of ["A₁", "A₂", "A₃", "A₄", "A₅", "A₆", "A₇"]) {
			expect(content).toContain(axiom);
		}
	});

	test("contains the Predicates block with core should_* rules", () => {
		expect(content).toContain("## Predicates");
		for (const predicate of [
			"should_remember",
			"should_recall",
			"should_capture_error",
			"should_decide",
			"should_pin",
			"should_invalidate",
		]) {
			expect(content).toContain(predicate);
		}
	});

	test("contains the Operations block with capture/recall/conflict flows", () => {
		expect(content).toContain("## Operations");
		for (const op of [
			"O_capture",
			"O_capture_error",
			"O_capture_decision",
			"O_recall",
			"O_react_to_conflict",
			"O_end_of_turn_feedback",
		]) {
			expect(content).toContain(op);
		}
	});

	test("contains the anti-pattern (¬do) section", () => {
		expect(content).toContain("## ¬do");
		expect(content).toContain("¬pin memories that can earn strength");
	});

	test("contains the observe-framing guidance", () => {
		expect(content).toContain("## Framing");
		expect(content).toContain("observations");
	});

	test("contains the outcome feedback loop description", () => {
		expect(content).toContain("Outcome feedback loop");
		expect(content).toContain("anchorId");
	});

	test("contains the store scope description", () => {
		expect(content).toContain("## Store scope");
		expect(content).toContain(".pi/hippo-memory/hippo.db");
		expect(content).toContain("~/.pi/hippo-memory/hippo.db");
	});

	test("contains the ¬touch safety section", () => {
		expect(content).toContain("## ¬touch");
		expect(content).toContain("frontmatter");
	});
});
