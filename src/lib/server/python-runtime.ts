import { spawnSync } from "node:child_process";

export interface PythonCommand {
  executable: string;
  args: string[];
}

/**
 * Finds the Python executable used by the ML adapters.
 *
 * Deployments do not all expose the same command name. In particular, some
 * Linux runtimes provide `python` but not `python3`, while Windows normally
 * provides `python` or the Python launcher `py`.
 */
export function resolvePythonCommand(): PythonCommand {
  const configured = process.env.ML_PYTHON_EXECUTABLE?.trim();
  if (configured) {
    return { executable: configured, args: [] };
  }

  const candidates = process.platform === "win32"
    ? [
        { executable: "python", args: [] },
        { executable: "py", args: ["-3"] },
        { executable: "python3", args: [] },
      ]
    : [
        { executable: "python3", args: [] },
        { executable: "python", args: [] },
        { executable: "py", args: ["-3"] },
      ];

  for (const candidate of candidates) {
    const probe = spawnSync(candidate.executable, [...candidate.args, "--version"], {
      cwd: process.cwd(),
      stdio: "ignore",
      windowsHide: true,
    });
    if (!probe.error && probe.status === 0) {
      return candidate;
    }
  }

  throw new Error(
    "No se encontró un intérprete Python disponible. Configura ML_PYTHON_EXECUTABLE o instala Python con las dependencias de ml/requirements.txt.",
  );
}
