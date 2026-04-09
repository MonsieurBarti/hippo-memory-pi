import { homedir } from "node:os";
import { join } from "node:path";

export interface ResolveRootsInput {
	cwd: string;
	config: { projectRoot?: string; globalRoot?: string };
}

export interface ResolvedRoots {
	projectRoot: string;
	globalRoot: string;
}

export function resolveRoots({ cwd, config }: ResolveRootsInput): ResolvedRoots {
	const projectRoot = config.projectRoot ?? join(cwd, ".pi", "hippo-memory");
	const globalRoot =
		config.globalRoot ?? process.env.HIPPO_HOME ?? join(homedir(), ".pi", "hippo-memory");
	return { projectRoot, globalRoot };
}
