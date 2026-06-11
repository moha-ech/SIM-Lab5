"""Tests del model SimPy instrumentat (app/model.py).

Comprova:
  - El payload té l'estructura que espera l'API/dashboard.
  - Emergeix el bus bunching (efecte acordeó): headway_cv apreciable.
  - La capacitat finita genera passatgers rebutjats; la infinita no.
  - Fidelitat al Lab1: intervals del mateix ordre de magnitud.
"""
import math
import pytest

from app.model import simulate, DEFAULTS


def test_payload_structure_valid():
    """simulate() amb defaults retorna un payload complet i coherent."""
    out = simulate({})

    # claus de primer nivell
    for key in ("params", "metrics", "num_stops", "dt", "stops",
                "frames", "headway_series"):
        assert key in out, f"falta la clau {key}"

    n = out["num_stops"]
    assert n == DEFAULTS["num_stops"]
    assert len(out["stops"]) == n
    for s in out["stops"]:
        assert {"id", "x", "y"} <= set(s)

    # frames no buits i ben formats
    frames = out["frames"]
    assert len(frames) > 0, "frames no pot estar buit"
    nb = out["params"]["num_buses"]
    for fr in frames[:5]:
        assert {"t", "buses", "occ", "queues"} <= set(fr)
        assert len(fr["buses"]) == nb
        assert len(fr["occ"]) == nb
        assert len(fr["queues"]) == n
        for pos in fr["buses"]:
            assert 0.0 <= pos < n  # coordenada de bucle [0, num_stops)

    # mètriques presents
    for m in ("mean_wait", "mean_headway", "headway_cv",
              "total_rejected", "max_queue", "mean_occupancy"):
        assert m in out["metrics"], f"falta la mètrica {m}"

    # headway_series per parada
    assert set(map(int, out["headway_series"].keys())) == set(range(n))


def test_bunching_emerges():
    """Escenari base: el coeficient de variació del headway és apreciable.

    El bus bunching es manifesta com a alta variabilitat dels intervals
    entre busos a una parada de referència. Un CV > 0.3 indica que els
    busos s'agrupen (no mantenen una separació regular).
    """
    out = simulate({"seed": 42})
    cv = out["metrics"]["headway_cv"]
    assert cv > 0.3, f"headway_cv={cv} massa baix; no emergeix bunching"


def test_finite_capacity_rejects_passengers():
    """Amb capacitat finita hi ha rebutjats; amb capacitat enorme, cap."""
    finite = simulate({"capacity": 50, "seed": 7})
    infinite = simulate({"capacity": 100000, "seed": 7})

    assert finite["metrics"]["total_rejected"] > 0
    assert infinite["metrics"]["total_rejected"] == 0


def test_fidelity_headway_order_of_magnitude():
    """Amb els paràmetres del Lab1, l'interval mitjà és de l'ordre del notebook.

    Al notebook (GPSS/SimPy) els intervals mitjans ronden 13-27 min
    (480/entries amb entries ~18-36). Comprovem el mateix ordre.
    """
    out = simulate({"seed": 42})
    mh = out["metrics"]["mean_headway"]
    assert 8.0 <= mh <= 40.0, f"mean_headway={mh} fora de l'ordre del Lab1"


def test_seed_is_deterministic():
    """Mateixa llavor => mateixes mètriques."""
    a = simulate({"seed": 123})
    b = simulate({"seed": 123})
    assert a["metrics"] == b["metrics"]
