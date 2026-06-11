/**
 * settings.js de Node-RED per a Railway.
 * Força el port a $PORT (Railway l'injecta) i escolta a 0.0.0.0.
 * Carrega el flux precarregat flows.json del mateix userDir (/data).
 */
module.exports = {
    uiPort: process.env.PORT || 1880,
    uiHost: "0.0.0.0",
    flowFile: "flows.json",
    flowFilePretty: true,
    functionGlobalContext: {},
    exportGlobalContextKeys: false,
    logging: {
        console: { level: "info", metrics: false, audit: false }
    },
    editorTheme: {
        projects: { enabled: false },
        page: { title: "SIM Lab5 — Node-RED" }
    }

    // adminAuth (opcional): per protegir l'editor públic, descomenta i posa un
    // hash bcrypt (genera'l amb `node-red admin hash-pw`).
    // adminAuth: {
    //   type: "credentials",
    //   users: [{ username: process.env.NODE_RED_USERNAME || "admin",
    //             password: process.env.NODE_RED_PASSWORD_HASH,
    //             permissions: "*" }]
    // }
};
