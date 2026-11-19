#!/usr/bin/env bash
set -euo pipefail
umask 077
backup_dir=${1:?Usage: ops/backup.sh /absolute/backup/directory}
[[ "$backup_dir" = /* ]] || { echo 'Backup directory must be absolute' >&2; exit 1; }
[[ ! -e "$backup_dir" ]] || { echo 'Choose a new backup directory' >&2; exit 1; }
engine=${CONTAINER_ENGINE:-docker}
compose() { "$engine" compose "$@"; }
mkdir -p "$backup_dir/photos" "$backup_dir/documents"
was_running=$(compose ps --status running --services backend)
if [[ -n "$was_running" ]]; then
  compose stop backend
  trap 'compose start backend' EXIT
fi
compose exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$backup_dir/database.dump"
# The helper shares the running storage network and receives credentials from Compose.
compose run --rm -T --no-deps -v "$backup_dir:/backup:Z" --entrypoint /bin/sh minio-init -ec '
  mc alias set source http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
  mc mirror "source/$S3_BUCKET" /backup/photos
  mc mirror "source/$S3_DOCUMENT_BUCKET" /backup/documents
'
(cd "$backup_dir" && sha256sum database.dump > database.sha256)
date -u +%FT%TZ > "$backup_dir/COMPLETE"
printf 'Backup completed: %s\n' "$backup_dir"
