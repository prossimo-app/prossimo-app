#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REDIS_IMAGE="${DEV_REDIS_IMAGE:-redis:8-alpine}"
REDIS_CONTAINER_NAME="${DEV_REDIS_CONTAINER_NAME:-prossimo-dev-redis}"
HOST_PORT="${DEV_REDIS_HOST_PORT:-6379}"
DATA_DIR="${DEV_REDIS_DATA_DIR:-$ROOT_DIR/.data/redis}"
REDIS_URL="redis://localhost:${HOST_PORT}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [start|stop|restart|logs|status]

Environment overrides:
  DEV_REDIS_HOST_PORT       Redis host port to bind. Default: 6379
  DEV_REDIS_DATA_DIR        Persistent data directory. Default: .data/redis
  DEV_REDIS_IMAGE           Redis image. Default: redis:8-alpine
  DEV_REDIS_CONTAINER_NAME  Redis container name. Default: prossimo-dev-redis
EOF
}

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

container_running() {
  [ "$(docker container inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true)" = "true" ]
}

start() {
  mkdir -p "$DATA_DIR"

  if container_running "$REDIS_CONTAINER_NAME"; then
    echo "Redis is already running in container: $REDIS_CONTAINER_NAME"
  elif container_exists "$REDIS_CONTAINER_NAME"; then
    docker start "$REDIS_CONTAINER_NAME" >/dev/null
    echo "Started existing Redis container: $REDIS_CONTAINER_NAME"
  else
    docker run \
      --detach \
      --name "$REDIS_CONTAINER_NAME" \
      --publish "${HOST_PORT}:6379" \
      --volume "${DATA_DIR}:/data" \
      "$REDIS_IMAGE" \
      redis-server --appendonly yes >/dev/null
    echo "Created and started Redis container: $REDIS_CONTAINER_NAME"
  fi

  echo "Data directory: $DATA_DIR"
  echo "REDIS_URL=$REDIS_URL"
}

stop_container() {
  local name="$1"
  local label="$2"

  if container_running "$name"; then
    docker stop "$name" >/dev/null
    echo "Stopped $label container: $name"
  else
    echo "$label container is not running: $name"
  fi
}

stop() {
  stop_container "$REDIS_CONTAINER_NAME" "Redis"
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
    docker logs --follow "$REDIS_CONTAINER_NAME"
    ;;
  status)
    docker container inspect "$REDIS_CONTAINER_NAME"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
