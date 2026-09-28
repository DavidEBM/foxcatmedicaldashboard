import { spawn } from "node:child_process";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const patient = await request.json();
  const command = process.platform === "win32" ? "python" : "python3";

  return new Promise<Response>((resolve) => {
    const child = spawn(command, ["ml/inference.py"], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    let error = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { error += chunk.toString(); });
    child.on("error", (cause) => resolve(NextResponse.json({ error: String(cause) }, { status: 503 })));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve(NextResponse.json({ error: error || "No se pudo ejecutar el modelo." }, { status: 503 }));
        return;
      }
      try {
        resolve(NextResponse.json(JSON.parse(output)));
      } catch {
        resolve(NextResponse.json({ error: "Respuesta inválida del motor IA." }, { status: 502 }));
      }
    });
    child.stdin.end(JSON.stringify(patient));
  });
}
