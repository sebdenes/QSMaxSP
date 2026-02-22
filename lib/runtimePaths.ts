import path from "node:path";

export function getProjectRoot(): string {
  const configuredRoot = process.env.QS_APP_ROOT;
  if (configuredRoot && configuredRoot.trim()) {
    return path.resolve(configuredRoot.trim());
  }

  return process.cwd();
}

export function resolveProjectPath(...parts: string[]): string {
  return path.join(getProjectRoot(), ...parts);
}
