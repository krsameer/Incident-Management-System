const apiBase = process.env.API_BASE_URL ?? 'http://localhost:3001';

const signals = [
  {
    componentId: 'RDBMS_PRIMARY_01',
    componentType: 'rdbms',
    source: 'synthetic-generator',
    severityHint: 'critical',
    message: 'Primary database latency spiked beyond SLO',
    details: { symptom: 'p95 write latency > 2s', phase: 'rdbms-outage' },
    timestamp: new Date().toISOString()
  },
  {
    componentId: 'MCP_HOST_07',
    componentType: 'mcp-host',
    source: 'synthetic-generator',
    severityHint: 'high',
    message: 'MCP host dropped connections during retry storm',
    details: { symptom: 'connection resets', phase: 'follow-on-failure' },
    timestamp: new Date().toISOString()
  }
];

for (const signal of signals) {
  const response = await fetch(`${apiBase}/signals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signal)
  });

  if (!response.ok) {
    throw new Error(`Failed to send signal: ${response.status} ${await response.text()}`);
  }
}

console.log(`Sent ${signals.length} synthetic outage signals to ${apiBase}`);
