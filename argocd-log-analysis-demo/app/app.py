"""checkout-api — a tiny service that stays healthy but whose logs tell the real story.

It serves /healthz (always 200) and continuously simulates checkout requests, writing
structured JSON logs to /var/log/app.log (shipped to Loki by a promtail sidecar).

The behavior differs between built image versions (baked in at build time via version.py —
there is no runtime flag):
  v1  → normal traffic + a recurring benign cache-miss WARN
  v2  → same, plus a deprecated-config WARN (noise) and an intermittent unhandled exception
        in the pricing path. The request handler catches it and still returns 200, so the
        pod looks perfectly healthy — only the logs reveal that order totals are breaking.
"""

import json
import os
import socket
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    from version import VERSION
except Exception:
    VERSION = "1"

SERVICE = "checkout-api"
POD = os.environ.get("HOSTNAME", socket.gethostname())
LOG_PATH = "/var/log/app.log"

_logfile = open(LOG_PATH, "a", buffering=1)


def log(level, message, **fields):
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "service": SERVICE,
        "pod": POD,
        "message": message,
    }
    record.update(fields)
    line = json.dumps(record)
    _logfile.write(line + "\n")
    print(line, flush=True)  # also to stdout for `kubectl logs`


def lookup_price(order_id, seq):
    # v2 regression: the new catalog client returns None for some items.
    if VERSION == "2" and seq % 2 == 0:
        return None
    return 4999  # cents


def compute_total(order_id, seq):
    price = lookup_price(order_id, seq)
    quantity = 3
    return price * quantity  # raises TypeError when price is None (v2)


def handle_checkout(order_id, seq):
    """Simulate handling one checkout request. Always returns 200 to the caller."""
    log("INFO", "received checkout request", order_id=order_id, endpoint="/api/checkout")
    try:
        total = compute_total(order_id, seq)
        log("INFO", "checkout completed", order_id=order_id,
            endpoint="/api/checkout", http_status=200, total_cents=total)
    except Exception as exc:  # noqa: BLE001 - the handler swallows it and still answers 200
        log("ERROR", "unhandled exception computing order total", order_id=order_id,
            endpoint="/api/checkout", http_status=200,
            error=f"{type(exc).__name__}: {exc}", loc="pricing.py:54")
    return 200


def traffic_loop():
    log("INFO", "checkout-api starting", version=VERSION)
    if VERSION == "2":
        # surface the new-version log lines immediately, not only after warmup
        log("WARN", "config key 'legacy_timeout' is deprecated; ignoring",
            config_key="legacy_timeout")

    seq = 0
    order = 1000
    while True:
        seq += 1
        order += 1
        order_id = f"ord-{order}"

        # pre-existing benign warning — present in BOTH v1 and v2
        if seq % 5 == 0:
            log("WARN", "cache miss for catalog entry, using slow path",
                cache_key=f"sku-{(order % 900) + 100}")

        # new noise — v2 only, harmless
        if VERSION == "2" and seq % 20 == 0:
            log("WARN", "config key 'legacy_timeout' is deprecated; ignoring",
                config_key="legacy_timeout")

        handle_checkout(order_id, seq)
        time.sleep(2)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
        elif self.path == "/api/checkout":
            handle_checkout(f"req-{int(time.time())}", int(time.time()))
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *args):
        pass  # silence default access logging; we emit our own JSON logs


def main():
    threading.Thread(target=traffic_loop, daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()


if __name__ == "__main__":
    main()
