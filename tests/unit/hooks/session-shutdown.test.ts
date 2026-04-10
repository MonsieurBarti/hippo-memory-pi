import { describe, expect, test, vi } from "vitest";
import { DEFAULT_CONFIG } from "../../../src/config";
import { createSessionShutdownHook } from "../../../src/hooks/session-shutdown";
import { createFakeService } from "../../fixtures/fake-memory-service";

function mockStatus(service: ReturnType<typeof createFakeService>, newSinceLastSleep: number) {
	const statusMock = vi.mocked(service.status);
	statusMock.mockResolvedValue({
		projectTotal: newSinceLastSleep * 2,
		globalTotal: 0,
		episodic: newSinceLastSleep,
		semantic: 0,
		buffer: 0,
		averageStrength: 0.5,
		newSinceLastSleep,
		lastSleepAt: null,
		searchMode: "bm25",
	});
}

describe("session-shutdown hook", () => {
	test("runs sleep when newSinceLastSleep meets threshold", async () => {
		const service = createFakeService();
		mockStatus(service, 6);
		const sleepMock = vi.mocked(service.sleep);
		const notify = vi.fn();

		const hook = createSessionShutdownHook({
			service,
			config: { ...DEFAULT_CONFIG, autoSleep: true, sleepThreshold: 5 },
			notify,
		});

		await hook({}, {});

		expect(sleepMock).toHaveBeenCalled();
		expect(vi.mocked(service.shutdown)).toHaveBeenCalled();
		expect(notify).toHaveBeenCalledWith(expect.stringContaining("Sleep"), "info");
	});

	test("skips sleep when under threshold", async () => {
		const service = createFakeService();
		mockStatus(service, 2);
		const sleepMock = vi.mocked(service.sleep);

		const hook = createSessionShutdownHook({
			service,
			config: { ...DEFAULT_CONFIG, autoSleep: true, sleepThreshold: 5 },
			notify: vi.fn(),
		});

		await hook({}, {});
		expect(sleepMock).not.toHaveBeenCalled();
		expect(vi.mocked(service.shutdown)).toHaveBeenCalled();
	});

	test("skips sleep entirely when autoSleep is false", async () => {
		const service = createFakeService();
		mockStatus(service, 99);
		const sleepMock = vi.mocked(service.sleep);
		const statusMock = vi.mocked(service.status);

		const hook = createSessionShutdownHook({
			service,
			config: { ...DEFAULT_CONFIG, autoSleep: false },
			notify: vi.fn(),
		});

		await hook({}, {});
		expect(statusMock).not.toHaveBeenCalled();
		expect(sleepMock).not.toHaveBeenCalled();
	});

	test("flushes working memory", async () => {
		const service = createFakeService();
		mockStatus(service, 0);
		const wmFlushMock = vi.mocked(service.wmFlush);

		const hook = createSessionShutdownHook({
			service,
			config: { ...DEFAULT_CONFIG, autoSleep: false },
			notify: vi.fn(),
		});
		await hook({}, {});
		expect(wmFlushMock).toHaveBeenCalled();
	});

	test("still calls shutdown when sleep throws", async () => {
		const service = createFakeService();
		mockStatus(service, 10);
		vi.mocked(service.sleep).mockRejectedValue(new Error("sleep broke"));
		const shutdownMock = vi.mocked(service.shutdown);

		const hook = createSessionShutdownHook({
			service,
			config: { ...DEFAULT_CONFIG, autoSleep: true, sleepThreshold: 5 },
			notify: vi.fn(),
		});

		await expect(hook({}, {})).resolves.not.toThrow();
		expect(shutdownMock).toHaveBeenCalled();
	});
});
