# Google Sheets — Web App (Apps Script)

Historial de runs del Digital Twin. El dashboard ("Desar a Google Sheets") i el
flux de Node-RED hi envien una fila per simulació via HTTP/REST.

## Desplegament (pas a pas)

1. Crea un full de càlcul nou a [sheets.new](https://sheets.new). La pestanya
   `Results` es crearà automàticament amb la capçalera a la primera fila.
2. Menú **Extensions → Apps Script**.
3. Enganxa el contingut de [`Code.gs`](./Code.gs) al fitxer `Code.gs` de l'editor.
4. (Opcional) A l'editor, **Configuració del projecte → Mostra
   `appsscript.json`** i copia-hi [`appsscript.json`](./appsscript.json) perquè
   els *scopes* i el tipus d'accés quedin fixats.
5. **Implementa → Implementació nova**:
   - Tipus: **Aplicació web**.
   - *Executar com a*: **jo mateix**.
   - *Qui hi té accés*: **Qualsevol** (`ANYONE_ANONYMOUS`).
6. Autoritza els permisos quan t'ho demani.
7. Copia la **URL de l'aplicació web** (acaba en `/exec`). Aquesta és la
   `GSHEET_WEBAPP_URL`.

## Provar-ho

```bash
# Ping (sense op) -> {"status":"ok",...}
curl -L "https://script.google.com/macros/s/XXXX/exec"

# Afegir una fila de prova
curl -L "https://script.google.com/macros/s/XXXX/exec?op=append&num_buses=2&num_stops=3&capacity=50&sim_time=480&variable_demand=false&seed=42&mean_wait=26.1&mean_headway=19.0&headway_cv=0.49&total_rejected=774&max_queue=90&mean_occupancy=43.4"
```

Hauria d'aparèixer una fila nova a la pestanya `Results`.

> `curl -L` segueix la redirecció `302` que fa Apps Script cap a
> `googleusercontent.com`. Des del navegador (fetch `no-cors`) també funciona.

## Connectar-ho amb el sim-service

Posa la URL `/exec` com a variable d'entorn del servei principal perquè el botó
del dashboard la reculli a `GET /config`:

```bash
railway variables set GSHEET_WEBAPP_URL="https://script.google.com/macros/s/XXXX/exec"
```
