#!/usr/bin/env bash
# Build + push both image versions of checkout-api.
#   :v1 = healthy baseline
#   :v2 = same, plus the new-version noise + the pricing regression
set -euo pipefail

IMAGE="${IMAGE:-europe-docker.pkg.dev/robusta-development/kubernetes-demos/checkout-api}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/app"

docker buildx build --platform linux/amd64 --push --build-arg VERSION=1 "${DIR}" -t "${IMAGE}:v1"
docker buildx build --platform linux/amd64 --push --build-arg VERSION=2 "${DIR}" -t "${IMAGE}:v2"

echo "Pushed ${IMAGE}:v1 and ${IMAGE}:v2"
