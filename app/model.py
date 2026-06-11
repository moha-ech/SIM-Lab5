"""
Digital Master — Model SimPy d'una línia de bus en bucle (efecte acordeó).

Basat en el Lab1 (Pràctica 1) d'aquest alumne: línia de bus en bucle amb
2 busos i 3 parades, i la seva extensió (Part D, opció B): **capacitat finita,
baixades i passatgers rebutjats**. Unitat de temps: minuts.

Aquest mòdul afegeix instrumentació respecte al notebook original:
  - registra la trajectòria de cada bus (legs) per poder ANIMAR la línia,
  - pre-mostreja "frames" a pas fix (dt) al servidor,
  - calcula mètriques de bunching (headway_cv), espera, rebutjats, etc.

NO implementa holding ni leapfrogging (això és d'un altre grup): les úniques
"perilles" del model són les del Lab1 — capacitat, baixades i demanda variable.
"""
from __future__ import annotations

import math
import random
from collections import deque

import simpy

# ============================================================
# Paràmetres per defecte (idèntics al Lab1)
# ============================================================
DEFAULTS = {
    "sim_time": 480,          # 8 hores
    "num_buses": 2,
    "bus_separation": 10,     # min entre sortides inicials (GENERATE 10,,0,2)
    "travel_time_mean": 5,    # trajecte entre parades
    "travel_time_spread": 1,  # uniforme ±1
    "num_stops": 3,
    "capacity": 50,           # capacitat màxima del bus (Part D)
    "variable_demand": False, # modula la demanda (hora punta / vall)
    "seed": None,
    "dt": 0.5,                # pas de mostreig de l'animació (min)
}

# Taxes d'arribada base (mitjana exponencial d'interarribades, min) — Lab1
BASE_ARRIVAL_RATES = {0: 3.0, 1: 1.0, 2: 2.5}

# FN$TPUJA: distribució discreta del temps d'embarcament (acumulada)
BOARDING_VALUES = [0.3, 0.5, 1.0, 2.0, 3.5]
BOARDING_CUM_PROBS = [0.50, 0.80, 0.93, 0.97, 1.00]


# ------------------------------------------------------------
# Mostratge de distribucions (idèntic al notebook)
# ------------------------------------------------------------
def sample_boarding_time(rng):
    """Temps d'embarcament d'un passatger segons FN$TPUJA."""
    r = rng.random()
    for val, cum_p in zip(BOARDING_VALUES, BOARDING_CUM_PROBS):
        if r <= cum_p:
            return val
    return BOARDING_VALUES[-1]


def sample_travel_time(rng, mean, spread):
    """Temps de trajecte uniforme: mean ± spread."""
    return mean + rng.uniform(-spread, spread)


def arrival_rate_for_stop(stop_id):
    """Taxa base d'una parada; per a >3 parades es repeteix el patró del Lab1."""
    return BASE_ARRIVAL_RATES[stop_id % len(BASE_ARRIVAL_RATES)]


def demand_multiplier(t, sim_time, variable_demand):
    """Multiplicador de demanda (>1 = més passatgers).

    Si variable_demand és True: hora punta al terç central de la simulació
    (x2.0) i hora vall a la resta (x0.6). Si és False, sempre 1.0.
    """
    if not variable_demand:
        return 1.0
    if sim_time / 3.0 <= t <= 2.0 * sim_time / 3.0:
        return 2.0   # hora punta
    return 0.6       # hora vall


# ------------------------------------------------------------
# Processos SimPy
# ------------------------------------------------------------
def passenger_arrivals(env, stop_id, arrival_times, state, p, rng):
    """Genera passatgers a una parada (Poisson amb taxa possiblement variable)."""
    base_mean = arrival_rate_for_stop(stop_id)
    while True:
        mult = demand_multiplier(env.now, p["sim_time"], p["variable_demand"])
        mean = base_mean / mult
        yield env.timeout(rng.expovariate(1.0 / mean))
        arrival_times[stop_id].append(env.now)        # FIFO de timestamps
        q = len(arrival_times[stop_id])
        state["queue_events"][stop_id].append((env.now, q))
        if q > state["max_queue"]:
            state["max_queue"] = q


def bus_process(env, bus_id, arrival_times, state, p, rng):
    """Un bus circulant en bucle amb capacitat finita, baixades i rebutjos.

    Geometria per a l'animació: les parades són a posicions enteres
    0..num_stops-1 sobre un bucle [0, num_stops). El bus interpola la posició
    durant els trajectes i la manté constant durant les parades (dwell).
    """
    n = p["num_stops"]
    cap = p["capacity"]
    occ = 0  # el bus surt buit de la terminal
    legs = state["legs"][bus_id]

    while True:
        for stop_id in range(n):
            # --- Trajecte (arc) fins a la parada ---
            if stop_id == 0:
                # Arc de l'última parada -> terminal -> parada 0: dues mostres
                # de trajecte (equival al "retorn" + "sortida" del notebook).
                t_arc = (sample_travel_time(rng, p["travel_time_mean"], p["travel_time_spread"])
                         + sample_travel_time(rng, p["travel_time_mean"], p["travel_time_spread"]))
                pos0, pos1 = n - 1, n        # n ≡ 0 (mòdul num_stops)
            else:
                t_arc = sample_travel_time(rng, p["travel_time_mean"], p["travel_time_spread"])
                pos0, pos1 = stop_id - 1, stop_id

            t0 = env.now
            legs.append((t0, t0 + t_arc, pos0, pos1, occ))
            yield env.timeout(t_arc)

            arrival_time = env.now

            # Interval entre busos a aquesta parada (indicador de bunching)
            last_time = state["last_bus_time"][stop_id]
            if last_time is not None:
                state["intervals"][stop_id].append((arrival_time, arrival_time - last_time))
            state["last_bus_time"][stop_id] = arrival_time

            # --- Capacitat finita (Part D, opció B) ---
            # 1. Baixen passatgers (alliberen espai)
            baixades = int(occ * rng.uniform(0.1, 0.4))
            occ -= baixades

            # 2. Quants poden pujar realment
            espai_lliure = cap - occ
            esperant = len(arrival_times[stop_id])
            pugen = min(esperant, espai_lliure)

            # 3. Rebutjats: els que volien pujar però no caben
            rebutjats = max(0, esperant - espai_lliure)
            state["total_rejected"] += rebutjats

            # 4. Embarquen els 'pugen' primers de la cua (FIFO) -> temps d'espera
            for _ in range(pugen):
                t_arr = arrival_times[stop_id].popleft()
                state["waits"].append(arrival_time - t_arr)
            occ += pugen

            # Estat de la cua just després d'embarcar (els rebutjats es queden)
            q_post = len(arrival_times[stop_id])
            state["queue_events"][stop_id].append((arrival_time, q_post))

            # 5. Dwell = suma dels temps d'embarcament dels que pugen
            dwell_start = env.now
            for _ in range(pugen):
                yield env.timeout(sample_boarding_time(rng))
            # Leg de parada (posició constant) amb l'ocupació resultant
            legs.append((dwell_start, env.now, stop_id, stop_id, occ))


# ------------------------------------------------------------
# Post-procés: frames i mètriques
# ------------------------------------------------------------
def _bus_state_at(legs, t):
    """Posició (coordenada de bucle) i ocupació d'un bus a l'instant t."""
    if not legs:
        return 0.0, 0
    if t <= legs[0][0]:
        return float(legs[0][2]), 0
    for (t0, t1, p0, p1, occ) in legs:
        if t0 <= t <= t1:
            frac = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
            return p0 + frac * (p1 - p0), occ
    # després de l'últim leg
    t0, t1, p0, p1, occ = legs[-1]
    return float(p1), occ


def _queue_at(events, t):
    """Mida de la cua d'una parada a l'instant t (esglaonada)."""
    val = 0
    for (te, v) in events:
        if te <= t:
            val = v
        else:
            break
    return val


def _build_frames(state, p):
    """Pre-mostreja frames a pas fix dt per a l'animació del frontend."""
    n = p["num_stops"]
    nb = p["num_buses"]
    dt = p["dt"]
    sim_time = p["sim_time"]
    n_frames = int(sim_time / dt) + 1

    frames = []
    occ_accum = 0.0
    occ_count = 0
    for k in range(n_frames):
        t = round(k * dt, 3)
        buses = []
        occs = []
        for b in range(nb):
            pos, occ = _bus_state_at(state["legs"][b], t)
            buses.append(round(pos % n, 3))
            occs.append(occ)
            occ_accum += occ
            occ_count += 1
        queues = [_queue_at(state["queue_events"][s], t) for s in range(n)]
        frames.append({"t": t, "buses": buses, "occ": occs, "queues": queues})

    mean_occupancy = (occ_accum / occ_count) if occ_count else 0.0
    return frames, mean_occupancy


def _stop_positions(n):
    """Posicions de les parades en un cercle (per dibuixar el bucle)."""
    stops = []
    for i in range(n):
        ang = 2.0 * math.pi * i / n - math.pi / 2.0  # comença a dalt
        stops.append({
            "id": i,
            "x": round(math.cos(ang), 4),
            "y": round(math.sin(ang), 4),
        })
    return stops


def _metrics(state, p, mean_occupancy):
    """Calcula totes les mètriques demanades."""
    ref = p["num_stops"] - 1  # parada de referència per al headway
    ref_intervals = [iv for _, iv in state["intervals"][ref]]

    if ref_intervals:
        mean_h = sum(ref_intervals) / len(ref_intervals)
        var = sum((x - mean_h) ** 2 for x in ref_intervals) / len(ref_intervals)
        std_h = math.sqrt(var)
        cv = std_h / mean_h if mean_h else 0.0
    else:
        mean_h = cv = 0.0

    mean_wait = (sum(state["waits"]) / len(state["waits"])) if state["waits"] else 0.0

    return {
        "mean_wait": round(mean_wait, 3),
        "mean_headway": round(mean_h, 3),
        "headway_cv": round(cv, 3),
        "total_rejected": int(state["total_rejected"]),
        "max_queue": int(state["max_queue"]),
        "mean_occupancy": round(mean_occupancy, 3),
    }


# ------------------------------------------------------------
# API pública del model
# ------------------------------------------------------------
def _resolve_params(params):
    """Combina els defaults amb els paràmetres rebuts i els valida."""
    p = dict(DEFAULTS)
    if params:
        for k, v in params.items():
            if k in p and v is not None:
                p[k] = v
    # tipus i límits raonables
    p["sim_time"] = float(p["sim_time"])
    p["num_buses"] = max(1, int(p["num_buses"]))
    p["num_stops"] = max(2, int(p["num_stops"]))
    p["capacity"] = max(1, int(p["capacity"]))
    p["bus_separation"] = float(p["bus_separation"])
    p["travel_time_mean"] = float(p["travel_time_mean"])
    p["travel_time_spread"] = float(p["travel_time_spread"])
    p["variable_demand"] = bool(p["variable_demand"])
    p["dt"] = float(p["dt"])
    return p


def simulate(params=None):
    """Executa una simulació completa i retorna el payload per a l'API/dashboard.

    Retorna un dict amb: params, metrics, num_stops, dt, stops, frames,
    headway_series.
    """
    p = _resolve_params(params)

    rng = random.Random(p["seed"])
    env = simpy.Environment()

    n = p["num_stops"]
    arrival_times = {i: deque() for i in range(n)}

    state = {
        "intervals": {i: [] for i in range(n)},
        "last_bus_time": {i: None for i in range(n)},
        "queue_events": {i: [] for i in range(n)},
        "legs": {b: [] for b in range(p["num_buses"])},
        "waits": [],
        "total_rejected": 0,
        "max_queue": 0,
    }

    # Generadors de passatgers (un per parada), amb RNG propi derivat
    for stop_id in range(n):
        env.process(passenger_arrivals(
            env, stop_id, arrival_times, state, p,
            random.Random(rng.randint(0, 2 ** 32))))

    # Busos amb separació inicial (GENERATE 10,,0,2)
    for bus_id in range(p["num_buses"]):
        bus_rng = random.Random(rng.randint(0, 2 ** 32))

        def start_bus(env, b_id, b_rng):
            yield env.timeout(b_id * p["bus_separation"])
            yield from bus_process(env, b_id, arrival_times, state, p, b_rng)

        env.process(start_bus(env, bus_id, bus_rng))

    env.run(until=p["sim_time"])

    frames, mean_occupancy = _build_frames(state, p)
    metrics = _metrics(state, p, mean_occupancy)

    headway_series = {
        str(s): [[round(t, 3), round(iv, 3)] for t, iv in state["intervals"][s]]
        for s in range(n)
    }

    return {
        "params": p,
        "metrics": metrics,
        "num_stops": n,
        "dt": p["dt"],
        "stops": _stop_positions(n),
        "frames": frames,
        "headway_series": headway_series,
    }
