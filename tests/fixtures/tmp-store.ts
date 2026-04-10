import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface TmpRoots {
	projectRoot: string;
	globalRoot: string;
	cleanup: () => void;
}

export function createTmpRoots(): TmpRoots {
	const projectRoot = mkdtempSync(join(tmpdir(), "hippo-project-"));
	const globalRoot = mkdtempSync(join(tmpdir(), "hippo-global-"));
	return {
		projectRoot,
		globalRoot,
		cleanup() {
			try {
				rmSync(projectRoot, { recursive: true, force: true });
			} catch {}
			try {
				rmSync(globalRoot, { recursive: true, force: true });
			} catch {}
		},
	};
}
