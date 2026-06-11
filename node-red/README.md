# Node-RED — automatització per lots

Flux que executa **els 4 escenaris** contra el sim-service i en volca les
mètriques a Google Sheets. És la peça d'**automatització basada en flux**
(equivalent flow-based als blocs de Snap! — slide 44, però amb HTTP/REST en lloc
de PubSub/MQTT).

> ✅ **Desplegat i en viu:** https://node-red-production-615a.up.railway.app
> El flux ja hi apareix **precarregat** (no cal importar res).

Pipeline del flux (per a cada escenari):
`config + escenaris` → `POST {SIM_URL}/simulate` → `mètriques → query Sheets` →
`GET {SHEET_URL}?op=append&...`.

## Variables d'entorn

| Variable | Servei | Descripció |
|----------|--------|------------|
| `SIM_URL` | node-red | Domini del sim-service. Ja configurada al desplegament. |
| `SHEET_URL`| node-red | URL `/exec` del Web App d'Apps Script. **La poses tu** quan el despleguis. |

Si `SHEET_URL` és buida, el flux s'executa igualment i mostra les mètriques per
debug (avís per escenari amb el `headway_cv`), però **no** desa a Sheets.

```bash
railway variables set SHEET_URL="https://script.google.com/macros/s/XXXX/exec" -s node-red
```

## Provar-ho (en viu)

1. Obre l'editor: https://node-red-production-615a.up.railway.app
2. Prem el polsador del node **▶ Executar lot**.
3. Obre el sidebar de **debug** (icona d'escarabat): hi veuràs les 4 respostes,
   una per escenari, amb el seu `headway_cv`.

Verificat des de la CLI (sense `SHEET_URL`, només execució):
`base cv=0.53 · finite cv=0.49 (774 rebutjats) · variable cv=0.75 · realistic cv=1.22`
— coincideixen amb les mètriques del Digital Master.

## Com es va desplegar a Railway (segon servei, via CLI)

El sim-service i Node-RED **comparteixen el repo**, així que Node-RED es construeix
des del subdirectori `node-red/` amb el seu `Dockerfile` (imatge oficial
`nodered/node-red:4.0` + `flows.json` i `settings.js` precarregats a `/data`).

```bash
# 1) Crear el servei dins del projecte existent (el del sim-service)
railway add --service node-red --variables "SIM_URL=https://sim-service-production-b9f5.up.railway.app"

# 2) Root Directory = node-red  (perquè usi node-red/Dockerfile i el seu
#    railway.json, i NO hereti el startCommand uvicorn del railway.json arrel).
#    Es fa des de la UI de Railway: servei node-red → Settings → Source →
#    Root Directory = "node-red"  (o per API, com es va fer aquí).

# 3) Desplegar i generar domini
railway up -s node-red
railway domain -s node-red
```

Detalls tècnics rellevants (per si cal reproduir-ho):
- `node-red/settings.js` força `uiPort = process.env.PORT` (Railway injecta `$PORT`)
  i `uiHost = 0.0.0.0`.
- `node-red/Dockerfile` desactiva el `HEALTHCHECK` de la imatge base (apunta al port
  1880 fix) amb `HEALTHCHECK NONE`.
- `node-red/railway.json` (config pròpia del servei, **sense** `startCommand`) evita
  que Node-RED arrenqui amb el `uvicorn ...` del `railway.json` de l'arrel.

## Editor públic (opcional: protegir-lo)

L'editor és accessible públicament. Per posar-hi usuari/contrasenya, descomenta el
bloc `adminAuth` de `node-red/settings.js`, genera un hash bcrypt
(`npx node-red admin hash-pw`) i torna a desplegar.
