import { parseCSV, getCSVStats, validateCSVRow, getNodeTypeFromProtocol } from './csvParser';
import type { SimpleCSVRow } from './csvParser';
import type { ParsedDiagram, DiagramNode, Edge } from '../store/types';

/**
 * Convert CSV rows to diagram structure
 */
export function csvToDiagram(rows: SimpleCSVRow[], title: string = 'APM Service Map'): ParsedDiagram {
  const nodesMap = new Map<string, DiagramNode>();
  const edges: Edge[] = [];
  const errors: string[] = [];

  // Process each row
  rows.forEach((row, index) => {
    // Validate row
    const rowErrors = validateCSVRow(row);
    if (rowErrors.length > 0) {
      errors.push(`Row ${index + 1}: ${rowErrors.join(', ')}`);
      return;
    }

    const sourceId = row.source_service.trim();
    const targetId = row.target_service.trim();
    const protocol = row.protocol.trim().toLowerCase();

    // Determine node types based on protocol
    const sourceType = 'service'; // Source is always a service
    const targetType = getNodeTypeFromProtocol(protocol);

    // Add source node if not exists
    if (!nodesMap.has(sourceId)) {
      nodesMap.set(sourceId, {
        id: sourceId,
        name: sourceId,
        type: sourceType,
        properties: {},
        connections: [],
      } as DiagramNode);
    }

    // Add target node if not exists
    if (!nodesMap.has(targetId)) {
      const node: DiagramNode = {
        id: targetId,
        name: targetId,
        type: targetType as 'service' | 'database' | 'queue',
        properties: {},
        ...(targetType === 'service' ? { connections: [] } : {}),
      } as DiagramNode;

      nodesMap.set(targetId, node);
    }

    // Create edge ID (allow multiple edges between same nodes with different protocols)
    const edgeId = `${sourceId}-${targetId}-${protocol}`;

    // Add edge
    edges.push({
      id: edgeId,
      from: sourceId,
      to: targetId,
      label: protocol, // Show protocol on edge
    });
  });

  if (errors.length > 0) {
    console.warn('⚠️ CSV parsing warnings:', errors);
  }

  // Get statistics
  const stats = getCSVStats(rows);
  console.log('📊 CSV Stats:', stats);

  // Convert nodes map to array
  const nodes = Array.from(nodesMap.values());

  return {
    mode: 'architecture',
    title,
    nodes,
    edges,
    groups: [], // No groups for CSV import
  };
}

/**
 * Import CSV file and generate diagram
 */
export async function importCSVFile(file: File): Promise<ParsedDiagram> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;

        if (!content) {
          throw new Error('Failed to read file content');
        }

        // Parse CSV
        const rows = parseCSV(content);

        if (rows.length === 0) {
          throw new Error('No data rows found in CSV');
        }

        // Get file name without extension for diagram title
        const title = file.name.replace(/\.csv$/i, '');

        // Convert to diagram
        const diagram = csvToDiagram(rows, title);

        resolve(diagram);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Generate DSL from CSV data
 */
export function csvToDSL(rows: SimpleCSVRow[], title: string = 'APM Service Map'): string {
  const nodesMap = new Map<string, { type: string; connections: string[] }>();

  // Build node map
  rows.forEach(row => {
    const sourceId = row.source_service.trim();
    const targetId = row.target_service.trim();
    const protocol = row.protocol.trim().toLowerCase();

    // Add source node
    if (!nodesMap.has(sourceId)) {
      nodesMap.set(sourceId, {
        type: 'service',
        connections: [],
      });
    }

    // Add connection
    nodesMap.get(sourceId)!.connections.push(targetId);

    // Add target node
    if (!nodesMap.has(targetId)) {
      const targetType = getNodeTypeFromProtocol(protocol);
      nodesMap.set(targetId, {
        type: targetType,
        connections: [],
      });
    }
  });

  // Generate DSL
  let dsl = `diagram: architecture\n`;
  dsl += `title: ${title}\n\n`;

  // Add nodes
  nodesMap.forEach((data, nodeId) => {
    dsl += `${data.type} ${nodeId} {\n`;

    if (data.connections.length > 0) {
      dsl += `  connects: ${data.connections.join(', ')}\n`;
    }

    dsl += `}\n\n`;
  });

  return dsl;
}
