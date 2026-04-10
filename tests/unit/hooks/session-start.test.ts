import { describe, expect, test, vi } from "vitest";
import { DEFAULT_CONFIG } from "../../../src/config";
import { createSessionStartHook } from "../../../src/hooks/session-start";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("session-start hook", () => {
	test("calls service.init with the provided cwd", async () => {
		const service = createFakeService();
		const initMock = vi.mocked(service.init);
		const notify = vi.fn();
		const hook = createSessionStartHook({
			service,
			config: { ...DEFAULT_CONFIG, autoLearnGit: false },
			notify,
		});

		await hook({ reason: "startup" }, { cwd: "/tmp/proj" });

		expect(initMock).toHaveBeenCalledWith("/tmp/proj");
		expect(notify).toHaveBeenCalledWith(expect.stringContaining("Hippo memory ready"), "info");
	});

	test("triggers learnFromGit when autoLearnGit is true", async () => {
		const service = createFakeService();
		const learnMock = vi.mocked(service.learnFromGit);
		const hook = createSessionStartHook({
			service,
			config: { ...DEFAULT_CONFIG, autoLearnGit: true },
			notify: vi.fn(),
		});

		await hook({ reason: "startup" }, { cwd: "/tmp/proj" });
		// Best-effort fire-and-forget; give the microtask queue a tick.
		await Promise.resolve();
		expect(learnMock).toHaveBeenCalled();
	});

	test("does not trigger learnFromGit when autoLearnGit is false", async () => {
		const service = createFakeService();
		const learnMock = vi.mocked(service.learnFromGit);
		const hook = createSessionStartHook({
			service,
			config: { ...DEFAULT_CONFIG, autoLearnGit: false },
			notify: vi.fn(),
		});

		await hook({ reason: "startup" }, { cwd: "/tmp/proj" });
		expect(learnMock).not.toHaveBeenCalled();
	});

	test("swallows learnFromGit errors without failing the session", async () => {
		const service = createFakeService();
		const learnMock = vi.mocked(service.learnFromGit);
		learnMock.mockRejectedValue(new Error("git missing"));

		const hook = createSessionStartHook({
			service,
			config: { ...DEFAULT_CONFIG, autoLearnGit: true },
			notify: vi.fn(),
		});

		await expect(hook({ reason: "startup" }, { cwd: "/tmp/proj" })).resolves.not.toThrow();
	});

	test("notifies error when service.init throws", async () => {
		const service = createFakeService();
		const initMock = vi.mocked(service.init);
		initMock.mockRejectedValue(new Error("store locked"));
		const notify = vi.fn();

		const hook = createSessionStartHook({
			service,
			config: { ...DEFAULT_CONFIG, autoLearnGit: false },
			notify,
		});

		await hook({ reason: "startup" }, { cwd: "/tmp/proj" });
		expect(notify).toHaveBeenCalledWith(expect.stringContaining("store locked"), "error");
	});
});
