import path from "node:path";
import express from "express";

const app = express();
const PORT = Number(process.env.PORT ?? 8080);

// Resolved from this module, not from process.cwd(): these assets are fetched
// by mail clients long after the process starts, and a cwd-relative root
// silently serves 404s whenever the service is launched from anywhere but this
// directory. Nothing is compiled to a dist/, so this path holds in every case.
const ASSETS = path.join(import.meta.dirname, "public");

app.use(
    express.static(ASSETS, {
        // Email images are refetched on every open, by every recipient,
        // forever. Cache hard and bust by filename when the logo changes.
        maxAge: "30d",
        immutable: true,
    })
);

// express.static alone 404s on "/", which leaves a platform healthcheck
// nothing to point at.
app.get("/healthz", (_req, res) => {
    res.type("text/plain").send("ok");
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Serving ${ASSETS} on port ${PORT}`);
});
