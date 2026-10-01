from __future__ import annotations

import io
import json
import sys
import tempfile
import uuid
from contextlib import redirect_stderr, redirect_stdout
from http.server import BaseHTTPRequestHandler
from pathlib import Path

from ml.train import main as train_main
from ml.vercel_runtime import now_iso, persist_job, publish_training_output, training_snapshot, verify_admin_token


def write_json(handler: BaseHTTPRequestHandler, payload: object, status: int) -> None:
    body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        job_id = str(uuid.uuid4())
        job = {
            "id": job_id,
            "status": "running",
            "algorithms": [],
            "targets": [],
            "includeFirebasePatients": True,
            "startedAt": now_iso(),
            "logs": "",
        }
        try:
            token = self.headers.get("Authorization", "").removeprefix("Bearer ").strip()
            verify_admin_token(token)
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            algorithms = [str(value) for value in body.get("algorithms", [])]
            targets = [str(value) for value in body.get("targets", [])]
            include_firebase = body.get("includeFirebasePatients") is not False
            if not algorithms or not targets:
                raise ValueError("Selecciona al menos un algoritmo y un target.")
            job.update({"algorithms": algorithms, "targets": targets, "includeFirebasePatients": include_firebase})
            persist_job(job)

            output_dir = Path(tempfile.gettempdir()) / f"foxcat-training-{job_id}"
            snapshot_path = output_dir.parent / f"firebase-patients-{job_id}.json"
            output_dir.mkdir(parents=True, exist_ok=True)
            args = ["train.py", "--output-dir", str(output_dir), "--algorithms", *algorithms, "--targets", *targets]
            if include_firebase:
                count = training_snapshot(snapshot_path)
                job["logs"] += f"[Firebase] {count} pacientes capturados.\n"
                args.extend(["--firebase-dataset", str(snapshot_path)])

            output = io.StringIO()
            error_output = io.StringIO()
            previous_argv = sys.argv
            sys.argv = args
            try:
                with redirect_stdout(output), redirect_stderr(error_output):
                    exit_code = int(train_main())
            finally:
                sys.argv = previous_argv

            logs = f"{job['logs']}{output.getvalue()}{error_output.getvalue()}"[-24000:]
            if exit_code != 0:
                raise RuntimeError(f"El entrenamiento terminÃ³ con cÃ³digo {exit_code}.")
            publish_training_output(output_dir, job_id)
            job.update({"status": "succeeded", "exitCode": 0, "finishedAt": now_iso(), "logs": logs})
            persist_job(job)
            write_json(self, {"job": job}, 200)
        except PermissionError as error:
            write_json(self, {"error": str(error)}, 403)
        except Exception as error:
            job.update({"status": "failed", "finishedAt": now_iso(), "error": str(error)})
            try:
                persist_job(job)
            except Exception:
                pass
            write_json(self, {"job": job, "error": str(error)}, 503)

    def do_GET(self) -> None:
        write_json(self, {"error": "El entrenamiento Vercel se consulta mediante el resultado del POST."}, 405)

    def log_message(self, _format: str, *_args: object) -> None:
        return
