"""
SIM-SERVICE (Digital Master) — FastAPI + SimPy.

Exposa el model com a servei REST (Client-Server) i serveix el dashboard
estàtic (Digital Shadow). Pensat per desplegar a Railway (llegeix $PORT).

Endpoints:
  GET  /health     -> estat del servei
  GET  /scenarios  -> presets d'escenari (assumpcions S/SD/SE)
  GET  /config     -> config exposada al frontend (URL del Google Sheets Web App)
  POST /simulate   -> executa una simulació i retorna mètriques + frames + sèries
  GET  /           -> dashboard (app/static/index.html)
"""
import os
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.model import simulate, DEFAULTS
from app.scenarios import get_scenarios

app = FastAPI(
    title="SIM Lab5 — Digital Twin línia de bus",
    description="Digital Master (SimPy) controlat per REST des del dashboard.",
    version="1.0.0",
)

# CORS obert perquè Node-RED (o eines externes) puguin cridar el servei.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SimRequest(BaseModel):
    """Paràmetres de simulació (tots opcionals; defaults del Lab1)."""
    num_buses: Optional[int] = None
    num_stops: Optional[int] = None
    capacity: Optional[int] = None
    sim_time: Optional[float] = None
    bus_separation: Optional[float] = None
    travel_time_mean: Optional[float] = None
    travel_time_spread: Optional[float] = None
    variable_demand: Optional[bool] = None
    seed: Optional[int] = None
    dt: Optional[float] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/scenarios")
def scenarios():
    return {"scenarios": get_scenarios(), "defaults": DEFAULTS}


@app.get("/config")
def config():
    """URL del Web App de Google Sheets (env var) per al botó de desar."""
    return {"gsheet_webapp_url": os.environ.get("GSHEET_WEBAPP_URL", "")}


@app.post("/simulate")
def run_simulate(req: SimRequest):
    params = req.model_dump(exclude_none=True)
    return simulate(params)


# Serveix el dashboard estàtic a "/" (ha d'anar després dels endpoints API).
_static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
