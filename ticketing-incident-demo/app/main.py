"""Ticketing platform service.

A single FastAPI codebase that runs as one of three roles in the ticketing
platform, selected by the SERVICE_NAME environment variable:

  * seat-selection - holds/returns available seats for an event
  * booking        - creates a booking for selected seats
  * payment        - charges for a booking

Every role talks to the same PostgreSQL database. The connection is verified on
startup; if the database is unreachable the process exits (see app/db.py).
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from app import db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("ticketing")

SERVICE_NAME = os.getenv("SERVICE_NAME", "seat-selection")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("Starting %s service", SERVICE_NAME)
    # Fail fast if we cannot reach the database - the service is useless without it.
    db.wait_for_database()
    logger.info("%s service is ready", SERVICE_NAME)
    yield
    logger.info("Shutting down %s service", SERVICE_NAME)


app = FastAPI(title=f"ticketing-{SERVICE_NAME}", lifespan=lifespan)


@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": SERVICE_NAME}


@app.get("/readyz")
def readyz():
    try:
        conn = db.connect()
        conn.close()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"database unavailable: {exc}")
    return {"status": "ready", "service": SERVICE_NAME}


@app.get("/seats")
def list_seats(event_id: int):
    """seat-selection role: list available seats for an event."""
    conn = db.connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, row_label, seat_number "
                "FROM seats WHERE event_id = %s AND status = 'available' "
                "ORDER BY row_label, seat_number",
                (event_id,),
            )
            seats = [
                {"id": row[0], "row": row[1], "seat": row[2]} for row in cur.fetchall()
            ]
        return {"event_id": event_id, "available_seats": seats}
    finally:
        conn.close()


@app.post("/bookings")
def create_booking(event_id: int, seat_id: int, customer: str):
    """booking role: reserve a seat for a customer."""
    conn = db.connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO bookings (event_id, seat_id, customer) "
                "VALUES (%s, %s, %s) RETURNING id",
                (event_id, seat_id, customer),
            )
            booking_id = cur.fetchone()[0]
            cur.execute("UPDATE seats SET status = 'booked' WHERE id = %s", (seat_id,))
        conn.commit()
        return {"booking_id": booking_id, "status": "reserved"}
    finally:
        conn.close()


@app.post("/payments")
def create_payment(booking_id: int, amount_cents: int):
    """payment role: record a payment for a booking."""
    conn = db.connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO payments (booking_id, amount_cents, status) "
                "VALUES (%s, %s, 'captured') RETURNING id",
                (booking_id, amount_cents),
            )
            payment_id = cur.fetchone()[0]
        conn.commit()
        return {"payment_id": payment_id, "status": "captured"}
    finally:
        conn.close()
