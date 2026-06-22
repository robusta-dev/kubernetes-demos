#!/usr/bin/env bash
set -euo pipefail
docker buildx build --platform linux/amd64 --push . \
  -t us-central1-docker.pkg.dev/genuine-flight-317411/devel/ticketing-service:v1
