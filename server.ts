import { readdir } from "node:fs/promises";
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

// The bare domain is what somebody pastes into a browser to check the host is
// alive, and static-only it answers with Express's stock "Cannot GET /" — a
// message that reads like a broken deployment when the service is perfectly
// fine. Say what is being served instead.
//
// Registered after the static mount, so an index.html added to public/ would
// still win. Read per request rather than cached at boot: the directory is a
// handful of files, and a cached listing would be wrong for the whole life of
// the process the first time an asset is added.
app.get("/", async (_req, res) => {
    const entries = await readdir(ASSETS, { withFileTypes: true });

    res.json({
        service: "indic-ai-email-assets",
        assets: entries
            .filter((entry) => entry.isFile())
            .map((entry) => `/${entry.name}`)
            .sort(),
        health: "/healthz",
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Serving ${ASSETS} on port ${PORT}`);
});
