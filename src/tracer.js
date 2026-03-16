/**
 * AOS Telemetry - OpenTelemetry Tracer Setup
 */

const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { Resource } = require('@opentelemetry/resources');
const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');
const { BatchSpanProcessor, ConsoleSpanExporter, SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const api = require('@opentelemetry/api');
const fs = require('fs');
const path = require('path');

class AOSTracer {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'aos-agent';
    this.agentName = options.agentName || 'openclaw-agent';
    this.exporterType = options.exporterType || 'console'; // console, otlp, file
    this.otlpEndpoint = options.otlpEndpoint || 'http://localhost:4318/v1/traces';
    this.exportPath = options.exportPath || path.join(process.env.HOME, 'aos-telemetry', 'traces');
    
    this.provider = null;
    this.tracer = null;
  }

  initialize() {
    // Create resource with agent metadata
    const resource = Resource.default().merge(
      new Resource({
        [SEMRESATTRS_SERVICE_NAME]: this.serviceName,
        [SEMRESATTRS_SERVICE_VERSION]: '2.0.0',
        'agent.name': this.agentName,
        'agent.platform': 'openclaw'
      })
    );

    // Create provider
    this.provider = new NodeTracerProvider({
      resource: resource,
    });

    // Configure exporter based on type
    let exporter;
    if (this.exporterType === 'otlp') {
      exporter = new OTLPTraceExporter({
        url: this.otlpEndpoint,
      });
    } else if (this.exporterType === 'file') {
      exporter = new FileSpanExporter(this.exportPath);
    } else {
      exporter = new ConsoleSpanExporter();
    }

    // Add span processor
    this.provider.addSpanProcessor(new BatchSpanProcessor(exporter));

    // Register provider
    this.provider.register();

    // Get tracer
    this.tracer = api.trace.getTracer('aos-telemetry', '2.0.0');

    return this.tracer;
  }

  getTracer() {
    if (!this.tracer) {
      return this.initialize();
    }
    return this.tracer;
  }

  shutdown() {
    return this.provider?.shutdown();
  }
}

/**
 * Custom file-based exporter for offline trace storage
 */
class FileSpanExporter {
  constructor(exportPath) {
    this.exportPath = exportPath;
    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }
  }

  export(spans, resultCallback) {
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const filename = path.join(this.exportPath, `traces-${timestamp}.jsonl`);
      
      const data = spans.map(span => JSON.stringify({
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
        parentSpanId: span.parentSpanId,
        name: span.name,
        kind: span.kind,
        startTime: span.startTime,
        endTime: span.endTime,
        attributes: span.attributes,
        events: span.events,
        status: span.status,
        duration: span.duration
      })).join('\n') + '\n';

      fs.appendFileSync(filename, data);
      resultCallback({ code: 0 });
    } catch (error) {
      resultCallback({ code: 1, error });
    }
  }

  shutdown() {
    return Promise.resolve();
  }
}

module.exports = { AOSTracer };
