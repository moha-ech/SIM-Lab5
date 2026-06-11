"""Tests de l'API FastAPI (app/main.py)."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_scenarios_lists_four_presets():
    r = client.get("/scenarios")
    assert r.status_code == 200
    data = r.json()
    assert len(data["scenarios"]) == 4
    for sc in data["scenarios"]:
        assert {"id", "name", "assumption", "params"} <= set(sc)


def test_simulate_defaults_returns_valid_payload():
    r = client.post("/simulate", json={})
    assert r.status_code == 200
    out = r.json()
    assert out["frames"], "frames no pot estar buit"
    assert "headway_cv" in out["metrics"]
    # coherència de mides
    nb = out["params"]["num_buses"]
    assert len(out["frames"][0]["buses"]) == nb


def test_simulate_respects_params():
    r = client.post("/simulate", json={"num_buses": 4, "num_stops": 6, "seed": 1})
    out = r.json()
    assert out["num_stops"] == 6
    assert len(out["frames"][0]["buses"]) == 4
