"use strict";
const { NodeSDK } = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { Resource } = require("@opentelemetry/resources");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-grpc");
const { OTLPMetricExporter } = require("@opentelemetry/exporter-metrics-otlp-grpc");
const { PeriodicExportingMetricReader } = require("@opentelemetry/sdk-metrics");
const process = require("process");

const serviceName = process.env.OTEL_SERVICE_NAME || "traceops-app";

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://otel-collector:4317";

const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || otlpEndpoint,
});

const metricExporter = new OTLPMetricExporter({
  url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || otlpEndpoint,
});

const sdk = new NodeSDK({
  resource: new Resource({
    "service.name": serviceName,
  }),
  traceExporter,
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 30000,
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

try {
  sdk.start();
  // eslint-disable-next-line no-console
  console.log("OpenTelemetry initialized");
  process.on("SIGTERM", async () => {
    try {
      await sdk.shutdown();
      process.exit(0);
    } catch (e) {
      process.exit(1);
    }
  });
} catch (err) {
  // eslint-disable-next-line no-console
  console.error("Error starting OpenTelemetry", err);
}
