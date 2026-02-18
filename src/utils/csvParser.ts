// CSV Parser for APM/OTel Data Import

export interface SimpleCSVRow {
  source_service: string;
  target_service: string;
  protocol: string;
  operation?: string;
  details?: string;
}

export type CSVFormat = 'simple' | 'detailed' | 'otel';

const PROTOCOL_MAP: Record<string, string> = {
  // HTTP/REST → Service (Blue)
  'http': 'service',
  'https': 'service',
  'rest': 'service',
  'graphql': 'service',

  // RPC → Service (Purple)
  'grpc': 'service',
  'rpc': 'service',

  // SQL → Database (Pink)
  'postgresql': 'database',
  'mysql': 'database',
  'sql': 'database',

  // NoSQL → Database (Pink)
  'mongodb': 'database',
  'redis': 'database',
  'nosql': 'database',

  // Queue → Queue (Green)
  'kafka': 'queue',
  'rabbitmq': 'queue',
  'sqs': 'queue',
};

/**
 * Detect CSV format from headers
 */
export function detectCSVFormat(headers: string[]): CSVFormat {
  const headerSet = new Set(headers.map(h => h.toLowerCase().trim()));

  // Simple format (most common)
  if (headerSet.has('source_service') && headerSet.has('target_service')) {
    return 'simple';
  }

  // OTel format
  if (headerSet.has('service.name') || headerSet.has('span.kind')) {
    return 'otel';
  }

  // Detailed format
  if (headerSet.has('latency_ms') || headerSet.has('call_count')) {
    return 'detailed';
  }

  // Default to simple
  return 'simple';
}

/**
 * Parse CSV line handling quotes
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Parse CSV content into rows
 */
export function parseCSV(content: string): SimpleCSVRow[] {
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse headers
  const headers = parseCSVLine(lines[0]);
  const format = detectCSVFormat(headers);

  console.log(`📊 Detected CSV format: ${format}`);
  console.log(`📋 Headers: ${headers.join(', ')}`);

  // Map to lowercase for easier lookup
  const headerMap: Record<string, number> = {};
  headers.forEach((header, index) => {
    headerMap[header.toLowerCase().trim()] = index;
  });

  // Parse data rows
  const rows: SimpleCSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    if (format === 'simple') {
      const sourceIdx = headerMap['source_service'];
      const targetIdx = headerMap['target_service'];
      const protocolIdx = headerMap['protocol'];
      const operationIdx = headerMap['operation'];
      const detailsIdx = headerMap['details'];

      if (sourceIdx === undefined || targetIdx === undefined || protocolIdx === undefined) {
        throw new Error(`Missing required columns in row ${i + 1}`);
      }

      rows.push({
        source_service: values[sourceIdx] || '',
        target_service: values[targetIdx] || '',
        protocol: values[protocolIdx] || '',
        operation: operationIdx !== undefined ? values[operationIdx] : undefined,
        details: detailsIdx !== undefined ? values[detailsIdx] : undefined,
      });
    } else {
      // For other formats, we'll handle them later
      throw new Error(`Format '${format}' not yet implemented. Please use simple format.`);
    }
  }

  console.log(`✅ Parsed ${rows.length} rows`);
  return rows;
}

/**
 * Get node type from protocol
 */
export function getNodeTypeFromProtocol(protocol: string): string {
  const normalized = protocol.toLowerCase().trim();
  return PROTOCOL_MAP[normalized] || 'service';
}

/**
 * Validate CSV row
 */
export function validateCSVRow(row: SimpleCSVRow): string[] {
  const errors: string[] = [];

  if (!row.source_service || row.source_service.trim() === '') {
    errors.push('source_service is required');
  }

  if (!row.target_service || row.target_service.trim() === '') {
    errors.push('target_service is required');
  }

  if (!row.protocol || row.protocol.trim() === '') {
    errors.push('protocol is required');
  }

  return errors;
}

/**
 * Get statistics from CSV data
 */
export function getCSVStats(rows: SimpleCSVRow[]) {
  const services = new Set<string>();
  const protocols = new Set<string>();

  rows.forEach(row => {
    services.add(row.source_service);
    services.add(row.target_service);
    protocols.add(row.protocol);
  });

  return {
    totalRows: rows.length,
    uniqueServices: services.size,
    uniqueProtocols: protocols.size,
    services: Array.from(services).sort(),
    protocols: Array.from(protocols).sort(),
  };
}
