# Node-RED (SIM Lab5) amb el flux del lot d'escenaris PRECARREGAT.
# Es desplega com a segon servei a Railway; no cal importar res a mà.
FROM nodered/node-red:4.0

# /data és el userDir de Node-RED. Hi copiem el flux i un settings.js que
# força uiPort=$PORT (Railway injecta $PORT) i uiHost=0.0.0.0.
# --chown perquè l'usuari 'node-red' (uid 1000) en tingui propietat.
COPY --chown=node-red:node-red settings.js /data/settings.js
COPY --chown=node-red:node-red flows.json /data/flows.json

# La imatge base porta un HEALTHCHECK fixat al port 1880; com que a Railway
# escoltem a $PORT, el desactivem perquè no marqui el contenidor com a unhealthy.
HEALTHCHECK NONE

EXPOSE 1880
