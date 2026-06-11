# Node-RED — automatització per lots

Flux que executa **els 4 escenaris** contra el sim-service i en volca les
mètriques a Google Sheets. És la peça d'**automatització basada en flux**
(equivalent block-based, però amb HTTP/REST en lloc de PubSub/MQTT).

> Node-RED és **secundari**: el core (sim-service + dashboard) funciona sol.
> El botó "Desar a Google Sheets" del dashboard ja desa runs individuals; aquest
> flux n'afegeix l'execució **en lot** dels presets.

## Importar el flux

1. Obre Node-RED (local: `npx node-red`, després `http://localhost:1880`).
2. Menú ☰ → **Importar** → enganxa [`flows.json`](./flows.json) → **Importar**.
3. Obre el node de funció **`config + escenaris`** i edita:
   - `SIM_URL` → domini públic de Railway (o `http://localhost:8000` en local).
   - `SHEET_URL` → la URL `/exec` del Web App d'Apps Script.
4. **Desplega** (botó superior dret).
5. Clica el polsador del node **`▶ Executar lot`**.

El flux fa, per a cada escenari: `POST {SIM_URL}/simulate` → extreu mètriques →
`GET {SHEET_URL}?op=append&...`. A la pestanya `Results` del full hi apareixen
4 files noves (una per escenari).

## Node-RED a Railway (opcional, segon servei)

Desplega la imatge oficial com a segon servei del projecte:

```bash
railway add --service node-red --image nodered/node-red:latest
railway variables set --service node-red TZ=Europe/Madrid
```

Després obre la URL pública de Node-RED, importa `flows.json` i posa a `SIM_URL`
el domini **intern o públic** del sim-service. Si prefereixes simplicitat, executa
Node-RED en local apuntant `SIM_URL` al domini públic de Railway.
