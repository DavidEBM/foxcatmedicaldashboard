import { spawn } from "node:child_process";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let patient: unknown;
  try {
    patient = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo de la solicitud debe ser JSON válido." }, { status: 400 });
  }
  const command = process.env.ML_PYTHON_EXECUTABLE?.trim()
    || (process.platform === "win32" ? "python" : "python3");

  return new Promise<Response>((resolve) => {
    const child = spawn(command, ["ml/inference.py"], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUTF8: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    let error = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { error += chunk.toString(); });
    child.on("error", (cause) => resolve(NextResponse.json({ error: String(cause) }, { status: 503 })));
    child.on("close", (code) => {
      let payload: unknown;
      try {
        payload = JSON.parse(output);
      } catch {
        payload = null;
      }

      if (code !== 0) {
        const modelError = payload && typeof payload === "object" && "error" in payload
          ? String(payload.error)
          : error || "No se pudo ejecutar el modelo.";
        resolve(NextResponse.json({ error: modelError }, { status: 503 }));
        return;
      }

      if (!payload || typeof payload !== "object" || "error" in payload) {
        const modelError = payload && typeof payload === "object" && "error" in payload
          ? String(payload.error)
          : "Respuesta inválida del motor IA.";
        resolve(NextResponse.json({ error: modelError }, { status: 502 }));
        return;
      }

      resolve(NextResponse.json(payload));
    });
    child.stdin.end(JSON.stringify(patient));
  });
}
