"""Database connection helpers for the ticketing platform services.

All services connect to the same PostgreSQL instance using the standard
DB_* environment variables. On startup a service must be able to reach the
database - if it cannot, the process exits so Kubernetes restarts it (and the
problem becomes visible as a CrashLoopBackOff instead of silently serving
errors).
"""

import logging
import os
import time

import psycopg2

logger = logging.getLogger("ticketing")

# Database connection settings (provided via env, see manifest.yaml).
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

# How long we try to reach the database on boot before giving up.
CONNECT_MAX_ATTEMPTS = int(os.getenv("DB_CONNECT_MAX_ATTEMPTS", "10"))
CONNECT_RETRY_SECONDS = int(os.getenv("DB_CONNECT_RETRY_SECONDS", "3"))


def connect():
    """Open a new connection to PostgreSQL using the DB_* settings."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        connect_timeout=5,
    )


def wait_for_database():
    """Block until the database is reachable, or exit the process.

    A service that cannot reach its database cannot serve customers, so there
    is no point in coming up degraded. We retry a handful of times to ride out
    a database restart, then fail hard with a clear log line.
    """
    for attempt in range(1, CONNECT_MAX_ATTEMPTS + 1):
        try:
            logger.info(
                "Connecting to ticketing database at %s:%s/%s (attempt %d/%d)",
                DB_HOST,
                DB_PORT,
                DB_NAME,
                attempt,
                CONNECT_MAX_ATTEMPTS,
            )
            conn = connect()
            conn.close()
            logger.info("Successfully connected to ticketing database at %s:%s", DB_HOST, DB_PORT)
            return
        except Exception as exc:  # noqa: BLE001 - we want to log the real driver error
            logger.error(
                "Could not connect to ticketing database at %s:%s - %s",
                DB_HOST,
                DB_PORT,
                exc,
            )
            if attempt < CONNECT_MAX_ATTEMPTS:
                time.sleep(CONNECT_RETRY_SECONDS)

    logger.critical(
        "FATAL: giving up after %d attempts - database %s:%s/%s is unreachable. "
        "Check the DB_HOST environment variable.",
        CONNECT_MAX_ATTEMPTS,
        DB_HOST,
        DB_PORT,
        DB_NAME,
    )
    raise SystemExit(1)
