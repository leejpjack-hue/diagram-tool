import type { ClipboardNode } from '../store/types';

/**
 * Generate a unique ID for a pasted node
 */
export function generateNodeId(prefix: string): string {
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${suffix}`;
}

/**
 * Extract a node's DSL block from the full DSL text
 * Returns the DSL block for the node with the given name
 */
export function extractNodeDSL(fullDSL: string, nodeName: string): string | null {
  // Match any node type declaration followed by the node name
  const pattern = new RegExp(
    `(service|database|queue|node)\\s+${escapeRegex(nodeName)}\\s*\\{[^}]*\\}`,
    'm'
  );
  const match = fullDSL.match(pattern);
  return match ? match[0] : null;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse a DSL node block into a ClipboardNode
 */
export function parseNodeDSL(nodeDSL: string): ClipboardNode | null {
  // Extract type and name
  const headerMatch = nodeDSL.match(/^(service|database|queue|node)\s+(\w+)\s*\{/m);
  if (!headerMatch) return null;
  
  const type = headerMatch[1];
  const name = headerMatch[2];
  
  // Extract properties
  const properties: Record<string, unknown> = {};
  const propPattern = /(\w+):\s*(.+?)(?=\n\s*\w+:|\n\s*\}$)/gm;
  let propMatch;
  
  while ((propMatch = propPattern.exec(nodeDSL)) !== null) {
    const key = propMatch[1];
    let value: unknown = propMatch[2].trim();
    
    // Parse arrays
    if (typeof value === 'string' && value.includes(',')) {
      value = value.split(',').map(s => s.trim());
    }
    
    properties[key] = value;
  }
  
  return { id: name, type, name, properties };
}

/**
 * Convert a ClipboardNode back to DSL
 */
export function nodeToDSL(node: ClipboardNode): string {
  const props = node.properties || {};
  let dsl = `${node.type} ${node.name} {\n`;
  
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        dsl += `  ${key}: ${value.join(', ')}\n`;
      } else if (typeof value === 'object') {
        dsl += `  ${key}: ${JSON.stringify(value)}\n`;
      } else {
        dsl += `  ${key}: ${value}\n`;
      }
    }
  }
  
  dsl += '}';
  return dsl;
}

/**
 * Check if there's a node with this name in the DSL
 */
export function isNameInDSL(dsl: string, name: string): boolean {
  const pattern = new RegExp(`^(service|database|queue|node)\\s+${escapeRegex(name)}\\s*[,\\{]?`, 'm');
  return pattern.test(dsl);
}

/**
 * Generate a new node name based on the original
 */
export function generateNewName(originalName: string): string {
  // Check if name already ends with a number suffix
  const match = originalName.match(/^(.+?)(\d+)$/);
  if (match) {
    const base = match[1];
    const num = parseInt(match[2], 10) + 1;
    return `${base}${num}`;
  }
  return `${originalName}2`;
}

/**
 * Get a unique name that doesn't conflict with existing names
 */
export function getUniqueName(dsl: string, baseName: string): string {
  let name = baseName;
  let attempts = 0;
  
  // If the base name doesn't exist, use it
  if (!isNameInDSL(dsl, baseName)) {
    return baseName;
  }
  
  // Otherwise, keep incrementing
  name = generateNewName(baseName);
  while (isNameInDSL(dsl, name) && attempts < 100) {
    name = generateNewName(name);
    attempts++;
  }
  
  return name;
}

/**
 * Insert a node DSL block into the DSL text
 */
export function insertNodeDSL(currentDSL: string, nodeDSL: string): string {
  // Find the last closing brace and insert after it
  const lines = currentDSL.split('\n');
  let insertIndex = lines.length;
  
  // Find last non-empty line that's a closing brace or end of content
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === '}') {
      insertIndex = i + 1;
      break;
    }
    if (line && !line.startsWith('//')) {
      insertIndex = i + 1;
    }
  }
  
  // Add blank line if needed
  if (insertIndex > 0 && insertIndex <= lines.length) {
    const prevLine = lines[insertIndex - 1]?.trim();
    if (prevLine && prevLine !== '') {
      lines.splice(insertIndex, 0, '', nodeDSL);
    } else {
      lines.splice(insertIndex, 0, nodeDSL);
    }
  } else {
    lines.push('', nodeDSL);
  }
  
  return lines.join('\n');
}

/**
 * Create a copy of a node with a new unique name
 */
export function duplicateNodeDSL(fullDSL: string, nodeDSL: string, originalName: string): string {
  const newName = getUniqueName(fullDSL, originalName);
  const newNodeDSL = nodeDSL.replace(
    new RegExp(`^(service|database|queue|node)\\s+${escapeRegex(originalName)}`),
    `$1 ${newName}`
  );
  return newNodeDSL;
}

/**
 * Rename a node in DSL text with a new ID
 */
export function renameNodeInDSL(dsl: string, oldName: string, newName: string): string {
  // Replace the node name on the declaration line
  const nodeTypePattern = new RegExp(`^(service|database|queue|node)\\s+${escapeRegex(oldName)}\\s*\\{`, 'm');
  return dsl.replace(nodeTypePattern, `$1 ${newName} {`);
}
