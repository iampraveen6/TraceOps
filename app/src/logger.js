"use strict";
const pino = require("pino");
const { context, trace } = require("@opentelemetry/api");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: undefined,
  messageKey: "message",
  timestamp: pino.stdTimeFunctions.isoTime,
});

function withTraceBindings() {
  const span = trace.getSpan(context.active());
  if (span) {
    const spanCtx = span.spanContext();
    if (spanCtx) {
      return { trace_id: spanCtx.traceId, span_id: spanCtx.spanId };
    }
  }
  return {};
}

function child() {
  return logger.child({}, { mixin: withTraceBindings });
}

module.exports = { logger, child };
