import { describe, expect, test } from "vitest";
import { Mutex } from "../../src/mutex";

describe("Mutex", () => {
	test("serializes concurrent runs", async () => {
		const mutex = new Mutex();
		const log: string[] = [];

		const runA = mutex.run(async () => {
			log.push("a:start");
			await new Promise((r) => setTimeout(r, 20));
			log.push("a:end");
			return "a";
		});

		const runB = mutex.run(async () => {
			log.push("b:start");
			await new Promise((r) => setTimeout(r, 5));
			log.push("b:end");
			return "b";
		});

		await Promise.all([runA, runB]);
		expect(log).toEqual(["a:start", "a:end", "b:start", "b:end"]);
	});

	test("releases the lock on thrown error so the next run still executes", async () => {
		const mutex = new Mutex();
		await expect(
			mutex.run(async () => {
				throw new Error("boom");
			}),
		).rejects.toThrow("boom");
		const result = await mutex.run(async () => 42);
		expect(result).toBe(42);
	});
});
