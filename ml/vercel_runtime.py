from __future__ import annotations

import json
import mimetypes
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PUBLISHED_PREFIX = "ml-published"
RUNS_PREFIX = "ml-runs"


def _private_key(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().replace("\\n", "\n").replace("\\r", "\r")
    return normalized if "BEGIN PRIVATE KEY" in normalized and "END PRIVATE KEY" in normalized else None


def _firebase_modules() -> tuple[Any, Any, Any, Any, Any]:
    import firebase_admin
    from firebase_admin import auth, credentials, firestore, storage

    service_account: dict[str, Any] = {}
    configured_credentials = (
        os.getenv("FIREBASE_ADMIN_CREDENTIALS_JSON")
        or os.getenv("FIREBASE_ADMIN_SERVICE_ACCOUNT")
        or os.getenv("FIREBASE_ADMIN_CREDENTIALS")
    )
    if configured_credentials:
        source = configured_credentials.strip()
        try:
            if source.startswith("{"):
                service_account = json.loads(source)
            else:
                credentials_path = Path(source)
                if credentials_path.is_file():
                    service_account = json.loads(credentials_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            service_account = {}

    project_id = (
        os.getenv("FIREBASE_ADMIN_PROJECT_ID")
        or service_account.get("project_id")
        or os.getenv("NEXT_PUBLIC_FIREBASE_PROJECT_ID")
    )
    client_email = os.getenv("FIREBASE_ADMIN_CLIENT_EMAIL") or service_account.get("client_email")
    private_key = _private_key(
        os.getenv("FIREBASE_ADMIN_PRIVATE_KEY") or service_account.get("private_key")
    )
    bucket_name = os.getenv("FIREBASE_ADMIN_STORAGE_BUCKET") or os.getenv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET")
    if not project_id or not client_email or not private_key:
        raise RuntimeError("Faltan las credenciales FIREBASE_ADMIN_* para el almacenamiento ML.")

    if not firebase_admin._apps:
        firebase_admin.initialize_app(
            credentials.Certificate({
                "type": "service_account",
                "project_id": project_id,
                "client_email": client_email,
                "private_key": private_key,
            }),
            {"storageBucket": bucket_name} if bucket_name else None,
        )
    app = firebase_admin.get_app()
    return firebase_admin, auth, firestore, storage, app


def verify_admin_token(token: str) -> str:
    _firebase_admin, auth, firestore, _storage, app = _firebase_modules()
    if not token:
        raise PermissionError("La sesiÃ³n administrativa es obligatoria.")
    decoded = auth.verify_id_token(token, app=app)
    uid = str(decoded["uid"])
    profile = firestore.client(app=app).collection("users").document(uid).get().to_dict() or {}
    if profile.get("role") != "admin" or profile.get("status") != "active":
        raise PermissionError("La cuenta no tiene permisos de administrador.")
    return uid


def storage_bucket() -> Any:
    _firebase_admin, _auth, _firestore, storage, app = _firebase_modules()
    return storage.bucket(app=app)


def training_snapshot(path: Path) -> int:
    _firebase_admin, _auth, firestore, _storage, app = _firebase_modules()
    records: list[dict[str, Any]] = []
    for document in firestore.client(app=app).collection("patients").stream():
        record = document.to_dict() or {}
        record["__firestoreId"] = document.id
        records.append(record)
    path.write_text(json.dumps({"patients": records}, ensure_ascii=False, default=str), encoding="utf-8")
    return len(records)


def persist_job(job: dict[str, Any]) -> None:
    _firebase_admin, _auth, firestore, _storage, app = _firebase_modules()
    firestore.client(app=app).collection("mlTrainingJobs").document(job["id"]).set(job)


def publish_training_output(output_dir: Path, run_id: str) -> None:
    bucket = storage_bucket()
    prefix = f"{RUNS_PREFIX}/{run_id}/"
    for file_path in output_dir.rglob("*"):
        if not file_path.is_file():
            continue
        relative = file_path.relative_to(output_dir).as_posix()
        blob = bucket.blob(f"{prefix}{relative}")
        blob.upload_from_filename(
            str(file_path),
            content_type=mimetypes.guess_type(file_path.name)[0] or "application/octet-stream",
        )

    pointer = bucket.blob(f"{PUBLISHED_PREFIX}/current.json")
    pointer.upload_from_string(
        json.dumps({"runId": run_id, "updatedAt": now_iso()}),
        content_type="application/json",
    )


def current_run_id(bucket: Any) -> str:
    payload = json.loads(bucket.blob(f"{PUBLISHED_PREFIX}/current.json").download_as_text())
    run_id = str(payload.get("runId", "")).strip()
    if not run_id:
        raise RuntimeError("No hay un entrenamiento publicado.")
    return run_id


def runtime_models_dir() -> Path | None:
    if os.getenv("ML_STORAGE_MODE", "local").lower() != "remote":
        return None
    try:
        bucket = storage_bucket()
        run_id = current_run_id(bucket)
        directory = Path(tempfile.gettempdir()) / "foxcat-ml-runtime" / run_id
        directory.mkdir(parents=True, exist_ok=True)
        prefix = f"{RUNS_PREFIX}/{run_id}/"
        bucket.blob(f"{prefix}training-manifest.json").download_to_filename(str(directory / "training-manifest.json"))
        for blob in bucket.list_blobs(prefix=prefix):
            name = blob.name.removeprefix(prefix)
            if not name.endswith(".joblib"):
                continue
            destination = directory / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            blob.download_to_filename(str(destination))
        return directory
    except Exception:
        return None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
