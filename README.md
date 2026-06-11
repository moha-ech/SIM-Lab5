# Digital Twin d'una línia de bus — *bus bunching* (efecte acordeó)

**Pràctica 5 · Simulació (UPC, 2025-26) · Indústria 4.0 / Societat 5.0**

Convertim el model de simulació del **Lab1** (línia de bus en bucle amb efecte
acordeó) en un **micromón controlable remotament**: un **Digital Twin** desplegat
al núvol on es poden modificar paràmetres, executar escenaris i veure els
resultats en temps real, tant en un **dashboard animat** com en un **Google
Sheets**.

> 🔗 **URL pública (Railway):** https://sim-service-production-b9f5.up.railway.app
> · [`/health`](https://sim-service-production-b9f5.up.railway.app/health)
> · [`/scenarios`](https://sim-service-production-b9f5.up.railway.app/scenarios)

---

## 1. Mapeig Digital Twin

| Component del Digital Twin | Implementació en aquest projecte |
|----------------------------|----------------------------------|
| **Digital Master** (el model) | Model SimPy instrumentat (`app/model.py`), servit per FastAPI. És la font de veritat: executa la simulació d'esdeveniments discrets. |
| **Digital Shadow** (el reflex) | Dashboard web a mida (`app/static/`) amb **animació en viu** de la línia + gràfics Plotly, i l'historial de runs a **Google Sheets**. |
| **Connexió** | **HTTP/REST (Client-Server)**: el dashboard i Node-RED criden el Master per `POST /simulate`; els resultats viatgen de tornada com a JSON. |
| **Automatització remota** | Es poden canviar paràmetres i escenaris des del dashboard (sliders/presets) i executar lots des de **Node-RED**. |

```
┌──────────────────────────────────────────────┐
│  DASHBOARD a mida (HTML/JS/Plotly)  · SHADOW   │
│  sliders · animació acordeó · gràfics · Sheets │
└──────────────┬─────────────────────────────────┘
               │ HTTP/REST (Client-Server)
┌──────────────▼─────────────────────────────────┐
│  SIM-SERVICE (FastAPI + SimPy)  · MASTER        │
│  /health · /scenarios · /config · /simulate     │
└──────────────┬─────────────────────────────────┘
               │ REST (lot d'escenaris)
┌──────────────▼───────────┐   HTTP   ┌──────────────────────┐
│  NODE-RED (flux)          │─────────►│  GOOGLE SHEETS        │
│  4 escenaris en lot       │          │  (Apps Script Web App)│
└──────────────────────────┘          └──────────────────────┘
```

## 2. El model (perilles del Lab1, **sense holding ni leapfrogging**)

Línia de bus en bucle, unitat = minuts. Reprodueix fidelment el Lab1 i la seva
extensió (Part D, opció B). Les úniques "perilles" configurables són les del
Lab1:

- **Capacitat finita** del bus → quan s'omple, els passatgers que no caben
  **es queden a la cua** (`total_rejected`).
- **Baixades**: a cada parada baixa un % aleatori (10–40 %) de l'ocupació.
- **Demanda variable**: modula la taxa d'arribada (hora punta/vall).
- Configurables també: `num_buses`, `num_stops`, `capacity`, `sim_time`,
  `bus_separation`, `seed`.

L'**efecte acordeó** (bunching) emergeix sol: un bus que es retarda recull més
passatgers → para més estona → es retarda encara més, mentre el de darrere
l'atrapa. L'indicador clau és el **coeficient de variació del headway**
(`headway_cv`): com més alt, més acordeó.

> ⚠️ **No** s'implementen *holding* ni *leapfrogging* (estratègies de control de
> l'acordeó): el focus és **observar** el fenomen amb les perilles del Lab1.

### Instrumentació per a l'animació

Cada bus registra els seus "legs" (trams) i el servidor **pre-mostreja frames**
a pas fix (`dt = 0.5 min`). El frontend només reprodueix els frames:

```json
{ "t": 12.0, "buses": [0.7, 2.4], "occ": [31, 5], "queues": [4, 0, 9] }
```

`buses[i]` és la coordenada de bucle `[0, num_stops)` del bus *i*.

## 3. Escenaris (assumpcions S / SD / SE)

`GET /scenarios` retorna 4 presets, etiquetats segons la taxonomia de
Fonseca i Casas:

1. **Base** — capacitat infinita, demanda constant *(SE: capacitat infinita)*.
2. **Capacitat finita** — `capacity:50` *(SE → apareixen rebutjats)*.
3. **Demanda variable** — punta/vall *(SD: taxa d'arribada variable)*.
4. **Línia realista** — 4 busos, 6 parades *(S: sistema ampliat; l'acordeó es veu millor)*.

## 4. Executar en local

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# obre http://localhost:8000
```

Provar l'API:

```bash
curl localhost:8000/health
curl localhost:8000/scenarios
curl -X POST localhost:8000/simulate -H 'Content-Type: application/json' -d '{"seed":42}'
```

Tests:

```bash
pytest -q          # model (bunching emergeix, payload vàlid) + API
```

## 5. Google Sheets i Node-RED

- **Google Sheets**: desplega el Web App d'Apps Script i posa la seva URL a
  `GSHEET_WEBAPP_URL`. Vegeu [`apps_script/README.md`](apps_script/README.md).
- **Node-RED**: importa [`node-red/flows.json`](node-red/flows.json) per executar
  els 4 escenaris en lot i volcar-los a Sheets. Vegeu
  [`node-red/README.md`](node-red/README.md).

## 6. Desplegament a Railway

El sim-service serveix **també** el dashboard, així que n'hi ha prou amb un
servei. Amb el [Railway CLI](https://docs.railway.app/develop/cli):

```bash
npm i -g @railway/cli
railway login
railway init                 # o: railway link  (si el projecte ja existeix)
railway up                   # build Nixpacks + deploy (usa requirements.txt + railway.json)
railway domain               # genera/mostra la URL pública

# variables d'entorn
railway variables set GSHEET_WEBAPP_URL="https://script.google.com/macros/s/XXXX/exec"
```

El `Procfile` / `railway.json` arrenquen `uvicorn app.main:app` al `$PORT` que
injecta Railway (**no** es fa servir un port fix).

Verificació contra el domini públic (desplegat i comprovat):

```bash
curl https://sim-service-production-b9f5.up.railway.app/health     # {"status":"ok"}
curl https://sim-service-production-b9f5.up.railway.app/scenarios
```

(Node-RED a Railway com a segon servei és opcional — vegeu `node-red/README.md`.)

## 7. Per què Client-Server i no PubSub/MQTT (contrast — slide 25)

Un altre grup va resoldre la pràctica amb **Snap! + MQTT/PubSub** i estratègies
de **holding/leapfrogging**. Aquesta entrega fa deliberadament **el contrari** a
cada capa per diferenciar-se:

| Dimensió | Altre grup (PubSub) | Aquesta entrega (Client-Server) |
|----------|---------------------|----------------------------------|
| Patró de comunicació | **Publish/Subscribe** (MQTT broker) — desacoblat, *push*, molts-a-molts | **Client-Server (HTTP/REST)** — petició/resposta, *pull*, sol·licitud explícita |
| Acoblament | Productors i consumidors no es coneixen; medien *topics* | El client coneix l'endpoint i espera la resposta amb les mètriques |
| Eina de control | **Snap!** (block-based visual) | **Dashboard web a mida** + **Node-RED** (flow-based) |
| Perilles del model | holding / leapfrogging (control de l'acordeó) | capacitat finita, rebutjats, baixades, demanda variable (Lab1) |
| Plus visual | historial en full | **animació en viu** de la línia (s'hi veu formar-se l'acordeó) |

En el patró **Client-Server**, el Digital Shadow demana l'estat al Master quan el
necessita i rep una resposta completa i autocontinguda (mètriques + trajectòria +
sèries) en una sola transacció REST. És el model adequat aquí perquè una
simulació és una **operació sota demanda** amb un resultat ben definit, no un
flux continu d'esdeveniments que calgui difondre a subscriptors anònims (que és
on brilla el PubSub/MQTT).

## 8. Estructura del repositori

```
app/
  main.py        FastAPI: endpoints + serveix el dashboard + CORS + PORT
  model.py       model SimPy instrumentat (trajectòria + mètriques)
  scenarios.py   presets amb camp 'assumption' (S/SD/SE)
  static/        dashboard (index.html, app.js, style.css)
apps_script/     Google Sheets Web App (Code.gs, appsscript.json, README)
node-red/        flows.json (4 escenaris en lot) + README
tests/           test_model.py, test_api.py
requirements.txt · Procfile · railway.json
```
