# 001 Initial Stack

## Decision
Use a Vite + React + TypeScript single-page app with Luxon for timezone handling.

## Why
The requirement is a real-time browser dashboard. A client-rendered app is enough for the first version because the history and forecast model can run in-browser without a backend.

## Consequences
The first version ships quickly and is easy to host as static files.

If a live telemetry source is added later, the service layer can be replaced without rewriting the UI.
