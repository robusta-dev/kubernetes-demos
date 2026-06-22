#!/usr/bin/env bash
set -euo pipefail
docker buildx build --platform linux/amd64 --push . \
  -t europe-docker.pkg.dev/robusta-development/kubernetes-demos/ticketing-service:v1
