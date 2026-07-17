/**
 * Auto-layout algorithms for diagram nodes
 * Uses hierarchical and force-directed approaches to minimize edge overlap
 */

export type LayoutDirection = 'TB' | 'LR';

/**
 * Calculate hierarchical layout based on node dependencies
 * Places nodes in layers based on their distance from sources.
 *
 * direction='TB' (default) → layers stack top→bottom, nodes spread horizontally.
 * direction='LR'           → layers stack left→right, nodes spread vertically.
 */
export function calculateHierarchicalLayout(
  nodes: Array<{ id: string; type: string; name: string }>,
  edges: Array<{ id: string; from: string; to: string }>,
  direction: LayoutDirection = 'TB',
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  
  if (nodes.length === 0) return positions;

  // Build adjacency list
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  
  nodes.forEach(node => {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  });
  
  edges.forEach(edge => {
    outgoing.get(edge.from)?.push(edge.to);
    incoming.get(edge.to)?.push(edge.from);
  });

  // Find nodes with no incoming edges (sources)
  const sources = nodes.filter(node => incoming.get(node.id)?.length === 0);
  
  // Calculate levels using BFS
  const levels = new Map<string, number>();
  const queue = sources.map(s => s.id);
  
  sources.forEach(s => levels.set(s.id, 0));
  
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const currentLevel = levels.get(nodeId) || 0;
    
    outgoing.get(nodeId)?.forEach(targetId => {
      if (!levels.has(targetId)) {
        levels.set(targetId, currentLevel + 1);
        queue.push(targetId);
      } else {
        // Update level if we found a longer path
        const existingLevel = levels.get(targetId)!;
        if (currentLevel + 1 > existingLevel) {
          levels.set(targetId, currentLevel + 1);
        }
      }
    });
  }

  // Group nodes by level
  const nodesByLevel = new Map<number, string[]>();
  levels.forEach((level, nodeId) => {
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(nodeId);
  });

  // Assign positions
  // For TB: levels move along Y, siblings spread along X.
  // For LR: levels move along X, siblings spread along Y.
  const startX = 100;
  const startY = 100;

  if (direction === 'LR') {
    const levelStepX = 360;     // horizontal distance between layers
    const siblingStepY = 160;   // vertical distance between sibling nodes within a layer
    const minSpan = 600;        // try to vertically center if smaller than this

    nodesByLevel.forEach((nodeIds, level) => {
      const levelX = startX + level * levelStepX;
      const totalHeight = (nodeIds.length - 1) * siblingStepY;
      const offsetY = startY + (totalHeight > minSpan ? 0 : (minSpan - totalHeight) / 2);

      nodeIds.forEach((nodeId, index) => {
        positions.set(nodeId, { x: levelX, y: offsetY + index * siblingStepY });
      });
    });

    // Disconnected nodes: stack to the right of the rightmost layer
    const disconnectedX = startX;
    let disconnectedY = startY;
    nodes.forEach(node => {
      if (!positions.has(node.id)) {
        positions.set(node.id, { x: disconnectedX, y: disconnectedY });
        disconnectedY += siblingStepY;
      }
    });
    return positions;
  }

  // TB (default)
  const levelWidth = 350;
  const nodeHeight = 180;

  nodesByLevel.forEach((nodeIds, level) => {
    const levelY = startY + level * nodeHeight;
    const totalWidth = (nodeIds.length - 1) * levelWidth;
    const offsetX = startX + (totalWidth > 800 ? 0 : (800 - totalWidth) / 2);

    nodeIds.forEach((nodeId, index) => {
      const x = offsetX + index * levelWidth;
      const y = levelY;
      positions.set(nodeId, { x, y });
    });
  });

  // Handle any nodes without levels (disconnected nodes)
  let disconnectedY = startY;
  nodes.forEach(node => {
    if (!positions.has(node.id)) {
      positions.set(node.id, { x: startX, y: disconnectedY });
      disconnectedY += 150;
    }
  });

  return positions;
}

/**
 * Apply force-directed layout to spread nodes and reduce overlap
 * This is applied after hierarchical layout for refinement
 */
export function applyForceDirectedLayout(
  positions: Map<string, { x: number; y: number }>,
  edges: Array<{ from: string; to: string }>,
  iterations: number = 50
): Map<string, { x: number; y: number }> {
  const nodeIds = Array.from(positions.keys());
  const nodeCount = nodeIds.length;
  
  if (nodeCount === 0) return positions;

  // Create adjacency map for quick lookup
  const connected = new Map<string, Set<string>>();
  nodeIds.forEach(id => connected.set(id, new Set()));
  
  edges.forEach(edge => {
    connected.get(edge.from)?.add(edge.to);
    connected.get(edge.to)?.add(edge.from);
  });

  // Simulation parameters
  const idealDistance = 250;
  const repulsionStrength = 50000;
  const attractionStrength = 0.1;

  // Clone positions
  const newPositions = new Map<string, { x: number; y: number }>();
  positions.forEach((pos, id) => {
    newPositions.set(id, { ...pos });
  });

  // Run simulation
  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, { x: number; y: number }>();
    nodeIds.forEach(id => forces.set(id, { x: 0, y: 0 }));

    // Calculate repulsion between all nodes
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const id1 = nodeIds[i];
        const id2 = nodeIds[j];
        const pos1 = newPositions.get(id1)!;
        const pos2 = newPositions.get(id2)!;
        
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const distance = Math.sqrt(dx * dx + dy * dy) + 1; // Avoid division by zero
        
        const force = repulsionStrength / (distance * distance);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        
        forces.get(id1)!.x += fx;
        forces.get(id1)!.y += fy;
        forces.get(id2)!.x -= fx;
        forces.get(id2)!.y -= fy;
      }
    }

    // Calculate attraction between connected nodes
    edges.forEach(edge => {
      const pos1 = newPositions.get(edge.from);
      const pos2 = newPositions.get(edge.to);

      if (!pos1 || !pos2) return;

      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      // Guard against distance = 0 (coincident starting positions from the
      // hierarchical pass) — without the +1 the force vector becomes
      // 0/0 = NaN and the NaN propagates through every node in one step.
      const distance = Math.sqrt(dx * dx + dy * dy) + 1;

      const force = (distance - idealDistance) * attractionStrength;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      forces.get(edge.from)!.x += fx;
      forces.get(edge.from)!.y += fy;
      forces.get(edge.to)!.x -= fx;
      forces.get(edge.to)!.y -= fy;
    });

    // Apply forces with damping
    const damping = 0.85;
    nodeIds.forEach(id => {
      const force = forces.get(id)!;
      const pos = newPositions.get(id)!;
      
      pos.x += force.x * damping;
      pos.y += force.y * damping;
    });
  }

  // Normalize positions to prevent nodes going off-screen
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  newPositions.forEach(pos => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x);
    maxY = Math.max(maxY, pos.y);
  });

  const offsetX = minX < 50 ? 50 - minX : 0;
  const offsetY = minY < 50 ? 50 - minY : 0;
  
  newPositions.forEach(pos => {
    pos.x += offsetX;
    pos.y += offsetY;
  });

  return newPositions;
}

/**
 * Resolve overlap between sub-system grouping rectangles.
 *
 * Each `group` block defines a set of member node ids. After the main layout
 * has placed every node, two groups can still end up with overlapping
 * bounding rectangles even when their members don't physically overlap. This
 * pass detects pairwise group-rectangle collisions and shifts the offending
 * group's members along the axis perpendicular to the flow direction until
 * the overlap is gone — preserving layer ordering along the flow axis.
 *
 * Returns a new positions map. Iterates up to a small bound and bails out
 * when stable. Non-grouped nodes are never moved.
 */
export function resolveGroupOverlaps(
  positions: Map<string, { x: number; y: number }>,
  groups: Array<{ id: string; contains: string[] }>,
  visibleIds: Set<string>,
  direction: LayoutDirection = 'TB',
  nodeW: number = 200,
  nodeH: number = 100,
  padding: number = 30,
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  positions.forEach((p, id) => out.set(id, { ...p }));

  type Rect = { minX: number; minY: number; maxX: number; maxY: number; members: string[] };
  const rects = new Map<string, Rect>();

  const computeRect = (members: string[]): Rect | null => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of members) {
      const p = out.get(id);
      if (!p) continue;
      minX = Math.min(minX, p.x - padding);
      minY = Math.min(minY, p.y - padding);
      maxX = Math.max(maxX, p.x + nodeW + padding);
      maxY = Math.max(maxY, p.y + nodeH + padding);
    }
    if (!isFinite(minX)) return null;
    return { minX, minY, maxX, maxY, members };
  };

  for (const g of groups) {
    const members = g.contains.filter(id => visibleIds.has(id));
    if (members.length === 0) continue;
    const r = computeRect(members);
    if (r) rects.set(g.id, r);
  }

  if (rects.size < 2) return out;

  // Push along the axis PERPENDICULAR to the flow so we don't disturb the
  // hierarchical layer ordering: TB → push along x; LR → push along y.
  const isLR = direction === 'LR';
  const pushAxis: 'x' | 'y' = isLR ? 'y' : 'x';
  const ids = Array.from(rects.keys());
  const SAFE_GAP = 20;

  for (let iter = 0; iter < 8; iter++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const ra = rects.get(ids[i])!;
        const rb = rects.get(ids[j])!;
        const ox = Math.min(ra.maxX, rb.maxX) - Math.max(ra.minX, rb.minX);
        const oy = Math.min(ra.maxY, rb.maxY) - Math.max(ra.minY, rb.minY);
        if (ox <= 0 || oy <= 0) continue;

        const push = (pushAxis === 'x' ? ox : oy) + SAFE_GAP;
        const dir = (pushAxis === 'x'
          ? (rb.minX >= ra.minX ? 1 : -1)
          : (rb.minY >= ra.minY ? 1 : -1));

        for (const id of rb.members) {
          const p = out.get(id);
          if (!p) continue;
          if (pushAxis === 'x') p.x += dir * push;
          else p.y += dir * push;
        }
        if (pushAxis === 'x') { rb.minX += dir * push; rb.maxX += dir * push; }
        else { rb.minY += dir * push; rb.maxY += dir * push; }
        moved = true;
      }
    }
    if (!moved) break;
  }

  return out;
}

/**
 * Main layout function that combines hierarchical and force-directed approaches.
 * `direction` defaults to TB (top→bottom). Pass 'LR' for left→right.
 */
export function calculateAutoLayout(
  nodes: Array<{ id: string; type: string; name: string }>,
  edges: Array<{ id: string; from: string; to: string }>,
  direction: LayoutDirection = 'TB',
): Map<string, { x: number; y: number }> {
  // Step 1: Calculate hierarchical layout
  const hierarchicalPositions = calculateHierarchicalLayout(nodes, edges, direction);

  // Step 2: Apply force-directed refinement
  const finalPositions = applyForceDirectedLayout(hierarchicalPositions, edges, 30);

  return finalPositions;
}
