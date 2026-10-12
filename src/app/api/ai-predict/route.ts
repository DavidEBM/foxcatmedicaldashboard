import { spawn } from "node:child_process";
import { NextResponse } from "next/server";

import { resolvePythonCommand } from "@/lib/server/python-runtime";
import { getAdminFirestore } from "@/services/firebase/admin-server-auth";

export const runtime = "nodejs";

async function activeModels(): Promise<Record<string, { model: string; sourceMode?: string }>> {
  const snapshot = await getAdminFirestore().collection("aiModels").where("active", "==", true).get();
  return Object.fromEntries(snapshot.docs
    .map((item) => {
      const data = item.data();
      const model = data.modelName ?? data.name;
      return [data.target, { model, sourceMode: data.sourceMode }];
    })
    .filter(([target, value]) => typeof target === "string" && typeof value === "object" && typeof (value as { model?: unknown }).model === "string"));
}

async function proxyToVercelPython(request: Request, patient: unknown, selectedModels: Record<string, { model: string; sourceMode?: string }>): Promise<Response> {
  const target = new URL("/api/ai-predict-vercel", request.url);
  const headers = new Headers({ "content-type": "application/json" });

  for (const name of ["authorization", "cookie"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const response = await fetch(target, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...(patient as Record<string, unknown>), activeModels: selectedModels }),
    cache: "no-store",
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  let patient: unknown;
  try {
    patient = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo de la solicitud debe ser JSON válido." }, { status: 400 });
  }
  // Vercel runs the compact Python model as a separate Function. The Node
  // route remains available for local development, where it can use the
  // project's configured Python interpreter.
  if (process.env.VERCEL === "1") {
    try {
      return await proxyToVercelPython(request, patient, await activeModels());
    } catch (cause) {
      return NextResponse.json(
        { error: cause instanceof Error ? cause.message : "No se pudo contactar el motor IA." },
        { status: 503 },
      );
    }
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

  const selectedModels = await activeModels();
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
    child.stdin.end(JSON.stringify({ ...(patient as Record<string, unknown>), activeModels: selectedModels }));
  });
}
