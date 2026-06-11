"""
Presets d'escenari (assumpcions) per al Digital Twin.

Cada escenari porta el camp `assumption` segons la taxonomia de
Fonseca i Casas (S / SD / SE) per facilitar la redacció de l'informe:
  - S  : assumpció estructural del sistema.
  - SD : assumpció sobre les dades (p.ex. taxa d'arribada variable).
  - SE : assumpció sobre l'entorn/experiment (p.ex. capacitat).

NO inclou holding ni leapfrogging: les perilles són només les del Lab1
(capacitat, baixades i demanda variable).
"""

SCENARIOS = [
    {
        "id": "base",
        "name": "Base (capacitat infinita, demanda constant)",
        "assumption": "SE: capacitat infinita — el bus mai rebutja passatgers; "
                      "serveix de referència del Lab1 original.",
        "params": {
            "num_buses": 2,
            "num_stops": 3,
            "capacity": 100000,
            "variable_demand": False,
            "sim_time": 480,
            "seed": 42,
        },
    },
    {
        "id": "finite",
        "name": "Capacitat finita",
        "assumption": "SE: capacitat finita (50) — apareixen passatgers "
                      "rebutjats quan el bus s'omple.",
        "params": {
            "num_buses": 2,
            "num_stops": 3,
            "capacity": 50,
            "variable_demand": False,
            "sim_time": 480,
            "seed": 42,
        },
    },
    {
        "id": "variable",
        "name": "Demanda variable",
        "assumption": "SD: taxa d'arribada variable (hora punta/vall) — la "
                      "demanda es modula al terç central de la simulació.",
        "params": {
            "num_buses": 2,
            "num_stops": 3,
            "capacity": 50,
            "variable_demand": True,
            "sim_time": 480,
            "seed": 42,
        },
    },
    {
        "id": "realistic",
        "name": "Línia realista (4 busos, 6 parades)",
        "assumption": "S: sistema ampliat (4 busos, 6 parades) amb capacitat "
                      "finita i demanda variable — l'efecte acordeó es veu millor.",
        "params": {
            "num_buses": 4,
            "num_stops": 6,
            "capacity": 50,
            "variable_demand": True,
            "sim_time": 480,
            "seed": 42,
        },
    },
]


def get_scenarios():
    """Retorna la llista de presets per a GET /scenarios."""
    return SCENARIOS
