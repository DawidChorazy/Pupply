#!/usr/bin/env bash
set -euo pipefail
backup_dir=${1:?Usage: ops/restore.sh /absolute/backup/directory --confirm-restore}
[[ "${2:-}" = --confirm-restore ]] || { echo 'Restore requires --confirm-restore and replaces database contents' >&2; exit 1; }
[[ "$backup_dir" = /* && -f "$backup_dir/COMPLETE" ]] || { echo 'A completed backup directory is required' >&2; exit 1; }
(cd "$backup_dir" && sha256sum -c database.sha256)
engine=${CONTAINER_ENGINE:-docker}
compose() { "$engine" compose "$@"; }
# Stop writers while restoring a consistent database and both storage buckets.
compose stop backend frontend
compose exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --single-transaction --exit-on-error' < "$backup_dir/database.dump"
compose run --rm -T --no-deps -v "$backup_dir:/backup:ro,Z" --entrypoint /bin/sh minio-init -ec '
  mc alias set target http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
  mc mb --ignore-existing "target/$S3_BUCKET"
  mc mb --ignore-existing "target/$S3_DOCUMENT_BUCKET"
  mc mirror --overwrite /backup/photos "target/$S3_BUCKET"
  mc mirror --overwrite /backup/documents "target/$S3_DOCUMENT_BUCKET"
  mc anonymous set download "target/$S3_BUCKET"
  mc anonymous set none "target/$S3_DOCUMENT_BUCKET"
'
compose up -d backend frontend
