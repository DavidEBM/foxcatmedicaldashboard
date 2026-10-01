import { spawn } from "node:child_process";
import { NextResponse } from "next/server";

import { resolvePythonCommand } from "@/lib/server/python-runtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let patient: unknown;
  try {
    patient = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo de la solicitud debe ser JSON válido." }, { status: 400 });
  }
  let child;
  try {
    const python = resolvePythonCommand();
    child = spawn(python.executable, [...python.args, "ml/inference.py"], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUTF8: "1" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "No se pudo iniciar Python." },
      { status: 503 },
    );
  }

  return new Promise<Response>((resolve) => {
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
