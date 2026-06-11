# Node-RED (SIM Lab5) amb el flux del lot d'escenaris PRECARREGAT.
# Es desplega com a segon servei a Railway; no cal importar res a mà.
FROM nodered/node-red:4.0

# /data és el userDir de Node-RED. Hi copiem el flux perquè es carregui sol
# a l'arrencada (flowFile per defecte = flows.json dins de /data).
# --chown perquè l'usuari 'node-red' (uid 1000) en tingui propietat.
COPY --chown=node-red:node-red flows.json /data/flows.json

# Node-RED ja escolta a (process.env.PORT || 1880), així que a Railway agafa $PORT
# automàticament. Exposem 1880 només a títol informatiu (local).
EXPOSE 1880
