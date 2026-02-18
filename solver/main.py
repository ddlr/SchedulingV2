"""FastAPI application for the ABA schedule solver."""

import os
import time
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import SolveRequest, SolveResponse
from solver import build_and_solve

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ABA Schedule Solver", version="1.0.0")

allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["POST", "OPTIONS", "GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/solve", response_model=SolveResponse)
def solve(request: SolveRequest):
    start = time.time()
    try:
        result = build_and_solve(request)
        result.solveTimeSeconds = round(time.time() - start, 3)
        logger.info(
            "Solve completed in %.3fs — %s (%d entries)",
            result.solveTimeSeconds,
            result.statusMessage,
            len(result.schedule),
        )
        return result
    except Exception as e:
        logger.exception("Solve failed")
        raise HTTPException(status_code=500, detail=str(e))
