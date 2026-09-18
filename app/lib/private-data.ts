import { join } from "node:path";

const projectRoot = process.env.INIT_CWD || process.env.npm_config_local_prefix || process.cwd();

export function privateDataPath(...segments: string[]) {
  return join(projectRoot, ".private-data", "data", ...segments);
}
