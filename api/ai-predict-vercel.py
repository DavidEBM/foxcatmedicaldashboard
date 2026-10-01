from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler

from ml.inference import predict


def write_json(handler: BaseHTTPRequestHandler, payload: object, status: int) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 1_000_000:
                write_json(self, {"error": "El cuerpo de la solicitud no es válido."}, 400)
                return

            patient = json.loads(self.rfile.read(content_length).decode("utf-8"))
            if not isinstance(patient, dict):
                write_json(self, {"error": "El cuerpo de la solicitud debe ser un objeto JSON."}, 400)
                return

            predictions, blocked_models = predict(patient)
            write_json(
                self,
                {"predictions": predictions, "blockedModels": blocked_models},
                200,
            )
        except json.JSONDecodeError:
            write_json(self, {"error": "El cuerpo de la solicitud debe ser JSON válido."}, 400)
        except Exception as error:  # surfaced to the client without exposing secrets
            write_json(self, {"error": str(error)}, 503)

    def do_GET(self) -> None:
        write_json(self, {"error": "Método no permitido."}, 405)

    def log_message(self, _format: str, *_args: object) -> None:
        return
