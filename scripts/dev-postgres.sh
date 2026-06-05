#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${DEV_POSTGRES_IMAGE_NAME:-prossimo-dev-postgres:18}"
BASE_IMAGE="${DEV_POSTGRES_BASE_IMAGE:-ghcr.io/gui/postgis:18-postgis-3.6}"
CONTAINER_NAME="${DEV_POSTGRES_CONTAINER_NAME:-prossimo-dev-postgres}"
HOST_PORT="${DEV_POSTGRES_HOST_PORT:-5432}"
DATA_DIR="${DEV_POSTGRES_DATA_DIR:-$ROOT_DIR/.data/postgres}"
DATABASE_URL="postgresql://prossimo:prossimo@localhost:${HOST_PORT}/prossimo"

usage() {
  cat <<EOF
Usage: $(basename "$0") [start|stop|restart|logs|status]

Environment overrides:
  DEV_POSTGRES_HOST_PORT       Host port to bind. Default: 5432
  DEV_POSTGRES_DATA_DIR        Persistent data directory. Default: .data/postgres
  DEV_POSTGRES_IMAGE_NAME      Docker image name. Default: prossimo-dev-postgres:18
  DEV_POSTGRES_BASE_IMAGE      Base image to build from. Default: ghcr.io/gui/postgis:18-postgis-3.6
  DEV_POSTGRES_CONTAINER_NAME  Docker container name. Default: prossimo-dev-postgres
EOF
}

container_exists() {
  docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1
}

container_running() {
  [ "$(docker container inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || true)" = "true" ]
}

start() {
  mkdir -p "$DATA_DIR"

  docker build \
    --build-arg "POSTGRES_IMAGE=$BASE_IMAGE" \
    --tag "$IMAGE_NAME" \
    "$ROOT_DIR/docker/postgres"

  if container_running; then
    echo "Postgres is already running in container: $CONTAINER_NAME"
  elif container_exists; then
    docker start "$CONTAINER_NAME" >/dev/null
    echo "Started existing Postgres container: $CONTAINER_NAME"
  else
    docker run \
      --detach \
      --name "$CONTAINER_NAME" \
      --publish "${HOST_PORT}:5432" \
      --volume "${DATA_DIR}:/var/lib/postgresql" \
      "$IMAGE_NAME" >/dev/null
    echo "Created and started Postgres container: $CONTAINER_NAME"
  fi

  echo "Data directory: $DATA_DIR"
  echo "Base image: $BASE_IMAGE"
  echo "DATABASE_URL=$DATABASE_URL"
}

stop() {
  if container_running; then
    docker stop "$CONTAINER_NAME" >/dev/null
    echo "Stopped Postgres container: $CONTAINER_NAME"
  else
    echo "Postgres container is not running: $CONTAINER_NAME"
  fi
}

case "${1:-start}" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  restart)
    stop
    start
    ;;
  logs)
    docker logs --follow "$CONTAINER_NAME"
    ;;
  status)
    docker container inspect "$CONTAINER_NAME"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
