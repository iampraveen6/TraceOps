"use strict";
const express = require("express");
const { trace, metrics, SpanStatusCode } = require("@opentelemetry/api");
const { child } = require("./logger");

const app = express();
const port = process.env.PORT || 3000;
const log = child();

const meter = metrics.getMeter("traceops-app");
const requestCounter = meter.createCounter("http_requests_total", {
  description: "Total number of HTTP requests",
});

app.get("/", async (req, res) => {
  const tracer = trace.getTracer("traceops-app");
  await tracer.startActiveSpan("handle_root", async (span) => {
    requestCounter.add(1, { route: "/", method: "GET", status: "200" });
    log.info({ route: "/" }, "Handling root request");
    span.setAttribute("custom.attr", "root");
    await new Promise((r) => setTimeout(r, 50));
    span.end();
  });
  res.json({ ok: true, message: "TraceOps up" });
});

app.get("/error", (req, res) => {
  const tracer = trace.getTracer("traceops-app");
  tracer.startActiveSpan("handle_error", (span) => {
    try {
      requestCounter.add(1, { route: "/error", method: "GET", status: "500" });
      throw new Error("Simulated failure");
    } catch (e) {
      span.recordException(e);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      log.error({ err: e }, "Error endpoint triggered");
      res.status(500).json({ ok: false, error: e.message });
    } finally {
      span.end();
    }
  });
});

app.listen(port, () => {
  log.info(`Server listening on port ${port}`);
});
