// components/diagram-studio/LayoutEngine.js
// Layout engine for handling different canvas layout types and constraints

/**
 * Layout Engine
 *
 * Handles layout constraints for different canvas types:
 * - matrix-2x2: Fixed 2x2 quadrant layouts
 * - timeline-lanes: Horizontal timeline with vertical lanes
 * - tree-top-down: Hierarchical tree structure
 * - column-board: Fixed columns (like Kanban/MoSCoW)
 * - structured-sections: Fixed section layouts
 * - story-map: 2D story mapping grid
 * - table: Tabular layouts
 * - freeform: No constraints
 */

// ============ LAYOUT TYPES ============

export const LAYOUT_TYPES = {
  MATRIX_2X2: 'matrix-2x2',
  TIMELINE_LANES: 'timeline-lanes',
  TREE_TOP_DOWN: 'tree-top-down',
  COLUMN_BOARD: 'column-board',
  STRUCTURED_SECTIONS: 'structured-sections',
  STORY_MAP: 'story-map',
  TABLE: 'table',
  FREEFORM: 'freeform',
};

// ============ ZONE UTILITIES ============

/**
 * Find the zone that contains a given point
 */
export function findContainingZone(x, y, elements) {
  const zones = elements.filter(el => el.isZone || el.type?.includes('zone') || el.type?.includes('section') || el.type?.includes('column') || el.type?.includes('phase'));

  for (const zone of zones) {
    const zoneRight = zone.x + (zone.size?.width || 400);
    const zoneBottom = zone.y + (zone.size?.height || 300);

    if (x >= zone.x && x <= zoneRight && y >= zone.y && y <= zoneBottom) {
      return zone;
    }
  }
  return null;
}

/**
 * Get all zones in the diagram
 */
export function getZones(elements) {
  return elements.filter(el =>
    el.isZone ||
    el.type?.includes('zone') ||
    el.type?.includes('section') ||
    el.type?.includes('column') ||
    el.type?.includes('phase') ||
    el.type?.includes('lane')
  );
}

/**
 * Get cards/items (non-zone elements)
 */
export function getCards(elements) {
  return elements.filter(el =>
    !el.isZone &&
    !el.type?.includes('zone') &&
    !el.type?.includes('section') &&
    !el.type?.includes('column') &&
    !el.type?.includes('phase') &&
    !el.type?.includes('lane')
  );
}

// ============ CONSTRAINT ENFORCEMENT ============

/**
 * Constrain an element's position to stay within its containing zone
 */
export function constrainToZone(element, zone, padding = 10) {
  if (!zone) return { x: element.x, y: element.y };

  const elWidth = element.size?.width || 140;
  const elHeight = element.size?.height || 100;
  const zoneWidth = zone.size?.width || 400;
  const zoneHeight = zone.size?.height || 300;

  // Account for zone header (approx 30px)
  const headerOffset = 35;

  let x = element.x;
  let y = element.y;

  // Constrain X
  const minX = zone.x + padding;
  const maxX = zone.x + zoneWidth - elWidth - padding;
  x = Math.max(minX, Math.min(maxX, x));

  // Constrain Y (account for header)
  const minY = zone.y + headerOffset + padding;
  const maxY = zone.y + zoneHeight - elHeight - padding;
  y = Math.max(minY, Math.min(maxY, y));

  return { x, y };
}

/**
 * Apply constraints based on layout settings
 */
export function applyLayoutConstraints(element, elements, settings = {}) {
  if (!settings.constrainToZones) {
    return { x: element.x, y: element.y };
  }

  // Find the zone this element should be in
  const centerX = element.x + (element.size?.width || 140) / 2;
  const centerY = element.y + (element.size?.height || 100) / 2;
  const zone = findContainingZone(centerX, centerY, elements);

  if (zone) {
    return constrainToZone(element, zone);
  }

  return { x: element.x, y: element.y };
}

// ============ HIERARCHY RULES ============

/**
 * Check if a connection is valid based on hierarchy rules
 */
export function isValidHierarchyConnection(sourceType, targetType, hierarchyRules) {
  if (!hierarchyRules) return true;

  const allowedTargets = hierarchyRules[sourceType];
  if (!allowedTargets) return true;

  return allowedTargets.includes(targetType);
}

/**
 * Get allowed child types for a given node type
 */
export function getAllowedChildTypes(nodeType, hierarchyRules) {
  if (!hierarchyRules) return null;
  return hierarchyRules[nodeType] || null;
}

// ============ AUTO-LAYOUT ============

/**
 * Auto-arrange cards within zones
 */
export function autoArrangeInZones(elements) {
  const zones = getZones(elements);
  const cards = getCards(elements);

  const arrangedCards = cards.map(card => ({ ...card }));

  for (const zone of zones) {
    const cardsInZone = arrangedCards.filter(card => {
      const centerX = card.x + (card.size?.width || 140) / 2;
      const centerY = card.y + (card.size?.height || 100) / 2;
      return findContainingZone(centerX, centerY, [zone]) !== null;
    });

    if (cardsInZone.length === 0) continue;

    // Arrange cards in a grid within the zone
    const padding = 10;
    const headerOffset = 40;
    const cardWidth = cardsInZone[0].size?.width || 140;
    const cardHeight = cardsInZone[0].size?.height || 100;
    const zoneWidth = zone.size?.width || 400;

    const cols = Math.floor((zoneWidth - padding * 2) / (cardWidth + padding));

    cardsInZone.forEach((card, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      card.x = zone.x + padding + col * (cardWidth + padding);
      card.y = zone.y + headerOffset + padding + row * (cardHeight + padding);
    });
  }

  return [...zones, ...arrangedCards];
}

/**
 * Auto-layout tree nodes (top-down)
 */
export function autoLayoutTree(elements, connections, startNodeType = 'outcome-node') {
  const arranged = elements.map(el => ({ ...el }));

  // Find root node
  const root = arranged.find(el => el.type === startNodeType);
  if (!root) return arranged;

  // Build adjacency list
  const children = {};
  connections.forEach(conn => {
    if (!children[conn.sourceId]) children[conn.sourceId] = [];
    children[conn.sourceId].push(conn.targetId);
  });

  // BFS to calculate levels
  const levels = {};
  const queue = [{ id: root.id, level: 0 }];
  while (queue.length > 0) {
    const { id, level } = queue.shift();
    levels[id] = level;

    const childIds = children[id] || [];
    childIds.forEach(childId => {
      if (levels[childId] === undefined) {
        queue.push({ id: childId, level: level + 1 });
      }
    });
  }

  // Group nodes by level
  const nodesByLevel = {};
  arranged.forEach(node => {
    const level = levels[node.id];
    if (level !== undefined) {
      if (!nodesByLevel[level]) nodesByLevel[level] = [];
      nodesByLevel[level].push(node);
    }
  });

  // Position nodes
  const verticalGap = 120;
  const horizontalGap = 40;
  const canvasWidth = 900;
  const startY = 30;

  Object.entries(nodesByLevel).forEach(([level, nodes]) => {
    const levelNum = parseInt(level);
    const totalWidth = nodes.reduce((sum, n) => sum + (n.size?.width || 160) + horizontalGap, -horizontalGap);
    let startX = (canvasWidth - totalWidth) / 2;

    nodes.forEach(node => {
      const nodeWidth = node.size?.width || 160;
      node.x = startX;
      node.y = startY + levelNum * verticalGap;
      startX += nodeWidth + horizontalGap;
    });
  });

  return arranged;
}

// ============ SNAP TO GRID ============

/**
 * Snap position to grid
 */
export function snapToGrid(x, y, gridSize = 20) {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}

// ============ LAYOUT PRESETS ============

/**
 * Get default layout configuration for a layout type
 */
export function getLayoutPreset(layoutType) {
  switch (layoutType) {
    case LAYOUT_TYPES.MATRIX_2X2:
      return {
        constrainToZones: true,
        allowConnections: false,
        gridSize: 20,
        snapToGrid: true,
      };

    case LAYOUT_TYPES.TIMELINE_LANES:
      return {
        constrainToZones: false,
        allowConnections: true,
        gridSize: 20,
        snapToGrid: true,
      };

    case LAYOUT_TYPES.TREE_TOP_DOWN:
      return {
        constrainToZones: false,
        allowConnections: true,
        gridSize: 20,
        snapToGrid: true,
        autoLayout: true,
      };

    case LAYOUT_TYPES.COLUMN_BOARD:
      return {
        constrainToZones: true,
        allowConnections: false,
        gridSize: 10,
        snapToGrid: true,
      };

    case LAYOUT_TYPES.STRUCTURED_SECTIONS:
      return {
        constrainToZones: true,
        allowConnections: false,
        gridSize: 10,
        snapToGrid: false,
      };

    case LAYOUT_TYPES.STORY_MAP:
      return {
        constrainToZones: false,
        allowConnections: false,
        gridSize: 20,
        snapToGrid: true,
      };

    case LAYOUT_TYPES.TABLE:
      return {
        constrainToZones: false,
        allowConnections: false,
        gridSize: 10,
        snapToGrid: true,
        tableMode: true,
      };

    case LAYOUT_TYPES.FREEFORM:
    default:
      return {
        constrainToZones: false,
        allowConnections: true,
        gridSize: 20,
        snapToGrid: true,
      };
  }
}

// ============ ZONE VALIDATION ============

/**
 * Check if all zones have at least one item
 */
export function validateZoneCoverage(elements) {
  const zones = getZones(elements);
  const cards = getCards(elements);

  const emptyZones = zones.filter(zone => {
    const cardsInZone = cards.filter(card => {
      const centerX = card.x + (card.size?.width || 140) / 2;
      const centerY = card.y + (card.size?.height || 100) / 2;
      return findContainingZone(centerX, centerY, [zone]) !== null;
    });
    return cardsInZone.length === 0;
  });

  return {
    valid: emptyZones.length === 0,
    emptyZones,
  };
}

/**
 * Get item count per zone
 */
export function getZoneItemCounts(elements) {
  const zones = getZones(elements);
  const cards = getCards(elements);

  const counts = {};

  zones.forEach(zone => {
    const cardsInZone = cards.filter(card => {
      const centerX = card.x + (card.size?.width || 140) / 2;
      const centerY = card.y + (card.size?.height || 100) / 2;
      return findContainingZone(centerX, centerY, [zone]) !== null;
    });
    counts[zone.id] = {
      zone,
      count: cardsInZone.length,
      cards: cardsInZone,
    };
  });

  return counts;
}

// ============ ADVANCED AUTO-LAYOUT ALGORITHMS ============

/**
 * Hierarchical Layout (Sugiyama-style)
 * Arranges nodes in layers with minimized edge crossings
 */
export function hierarchicalLayout(elements, connections, options = {}) {
  const {
    direction = 'top-down', // 'top-down', 'bottom-up', 'left-right', 'right-left'
    layerSpacing = 120,
    nodeSpacing = 40,
    startX = 50,
    startY = 50,
  } = options;

  if (elements.length === 0) return elements;

  // Build adjacency lists
  const outgoing = {};
  const incoming = {};
  elements.forEach(el => {
    outgoing[el.id] = [];
    incoming[el.id] = [];
  });
  connections.forEach(conn => {
    if (outgoing[conn.sourceId]) outgoing[conn.sourceId].push(conn.targetId);
    if (incoming[conn.targetId]) incoming[conn.targetId].push(conn.sourceId);
  });

  // Find root nodes (no incoming connections)
  const roots = elements.filter(el => incoming[el.id]?.length === 0);
  if (roots.length === 0) {
    // No clear roots, use first element
    roots.push(elements[0]);
  }

  // Assign layers using BFS
  const layers = {};
  const visited = new Set();
  let maxLayer = 0;

  const queue = roots.map(r => ({ id: r.id, layer: 0 }));
  while (queue.length > 0) {
    const { id, layer } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    layers[id] = Math.max(layers[id] || 0, layer);
    maxLayer = Math.max(maxLayer, layers[id]);

    (outgoing[id] || []).forEach(childId => {
      if (!visited.has(childId)) {
        queue.push({ id: childId, layer: layer + 1 });
      }
    });
  }

  // Assign unvisited nodes to last layer
  elements.forEach(el => {
    if (!visited.has(el.id)) {
      layers[el.id] = maxLayer + 1;
    }
  });

  // Group nodes by layer
  const nodesByLayer = {};
  elements.forEach(el => {
    const layer = layers[el.id] || 0;
    if (!nodesByLayer[layer]) nodesByLayer[layer] = [];
    nodesByLayer[layer].push(el);
  });

  // Position nodes
  const arranged = elements.map(el => ({ ...el }));
  const isHorizontal = direction === 'left-right' || direction === 'right-left';
  const isReversed = direction === 'bottom-up' || direction === 'right-left';

  Object.entries(nodesByLayer).forEach(([layerStr, nodes]) => {
    const layerNum = isReversed ? maxLayer - parseInt(layerStr) : parseInt(layerStr);

    nodes.forEach((node, index) => {
      const nodeEl = arranged.find(el => el.id === node.id);
      if (!nodeEl) return;

      const nodeWidth = nodeEl.size?.width || 120;
      const nodeHeight = nodeEl.size?.height || 60;

      if (isHorizontal) {
        nodeEl.x = startX + layerNum * layerSpacing;
        nodeEl.y = startY + index * (nodeHeight + nodeSpacing);
      } else {
        nodeEl.x = startX + index * (nodeWidth + nodeSpacing);
        nodeEl.y = startY + layerNum * layerSpacing;
      }
    });
  });

  return arranged;
}

/**
 * Force-Directed Layout
 * Uses spring simulation for organic spacing
 */
export function forceDirectedLayout(elements, connections, options = {}) {
  const {
    iterations = 100,
    idealDistance = 150,
    repulsionStrength = 1000,
    attractionStrength = 0.01,
    centerX = 400,
    centerY = 300,
    damping = 0.9,
  } = options;

  if (elements.length === 0) return elements;

  // Initialize positions (spread around center if overlapping)
  const nodes = elements.map((el, i) => ({
    ...el,
    vx: 0,
    vy: 0,
    x: el.x || centerX + (Math.random() - 0.5) * 200,
    y: el.y || centerY + (Math.random() - 0.5) * 200,
  }));

  // Build connection lookup
  const connectedPairs = new Set();
  connections.forEach(conn => {
    connectedPairs.add(`${conn.sourceId}-${conn.targetId}`);
    connectedPairs.add(`${conn.targetId}-${conn.sourceId}`);
  });

  const isConnected = (a, b) => connectedPairs.has(`${a}-${b}`);

  // Run simulation
  for (let iter = 0; iter < iterations; iter++) {
    const temperature = 1 - iter / iterations;

    // Calculate repulsion forces
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];

        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Repulsion force (inversely proportional to distance squared)
        const force = (repulsionStrength / (dist * dist)) * temperature;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        nodeA.vx -= fx;
        nodeA.vy -= fy;
        nodeB.vx += fx;
        nodeB.vy += fy;
      }
    }

    // Calculate attraction forces (for connected nodes)
    connections.forEach(conn => {
      const nodeA = nodes.find(n => n.id === conn.sourceId);
      const nodeB = nodes.find(n => n.id === conn.targetId);
      if (!nodeA || !nodeB) return;

      const dx = nodeB.x - nodeA.x;
      const dy = nodeB.y - nodeA.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Attraction force (proportional to distance)
      const force = (dist - idealDistance) * attractionStrength * temperature;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      nodeA.vx += fx;
      nodeA.vy += fy;
      nodeB.vx -= fx;
      nodeB.vy -= fy;
    });

    // Apply velocities with damping
    nodes.forEach(node => {
      node.x += node.vx * damping;
      node.y += node.vy * damping;
      node.vx *= damping;
      node.vy *= damping;
    });
  }

  // Ensure positive coordinates
  const minX = Math.min(...nodes.map(n => n.x));
  const minY = Math.min(...nodes.map(n => n.y));
  const offsetX = minX < 50 ? 50 - minX : 0;
  const offsetY = minY < 50 ? 50 - minY : 0;

  return nodes.map(({ vx, vy, ...node }) => ({
    ...node,
    x: Math.round(node.x + offsetX),
    y: Math.round(node.y + offsetY),
  }));
}

/**
 * Grid Layout
 * Arranges nodes in a uniform grid
 */
export function gridLayout(elements, options = {}) {
  const {
    columns = 4,
    cellWidth = 180,
    cellHeight = 120,
    paddingX = 40,
    paddingY = 40,
    startX = 50,
    startY = 50,
  } = options;

  if (elements.length === 0) return elements;

  return elements.map((el, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);

    return {
      ...el,
      x: startX + col * (cellWidth + paddingX),
      y: startY + row * (cellHeight + paddingY),
    };
  });
}

/**
 * Circular Layout
 * Arranges nodes in a circle
 */
export function circularLayout(elements, options = {}) {
  const {
    centerX = 400,
    centerY = 300,
    radius = 200,
    startAngle = -Math.PI / 2, // Start from top
  } = options;

  if (elements.length === 0) return elements;

  const angleStep = (2 * Math.PI) / elements.length;

  return elements.map((el, index) => {
    const angle = startAngle + index * angleStep;
    const nodeWidth = el.size?.width || 120;
    const nodeHeight = el.size?.height || 60;

    return {
      ...el,
      x: Math.round(centerX + radius * Math.cos(angle) - nodeWidth / 2),
      y: Math.round(centerY + radius * Math.sin(angle) - nodeHeight / 2),
    };
  });
}

/**
 * Tree Layout
 * Arranges nodes in a tree structure with proper spacing
 */
export function treeLayout(elements, connections, options = {}) {
  const {
    direction = 'top-down',
    levelSpacing = 100,
    siblingSpacing = 40,
    startX = 50,
    startY = 50,
  } = options;

  if (elements.length === 0) return elements;

  // Build parent-child relationships
  const children = {};
  const parents = {};
  elements.forEach(el => {
    children[el.id] = [];
    parents[el.id] = null;
  });

  connections.forEach(conn => {
    if (children[conn.sourceId]) {
      children[conn.sourceId].push(conn.targetId);
      parents[conn.targetId] = conn.sourceId;
    }
  });

  // Find root(s)
  const roots = elements.filter(el => parents[el.id] === null);
  if (roots.length === 0) roots.push(elements[0]);

  // Calculate subtree widths
  const widths = {};
  const calculateWidth = (nodeId) => {
    const childIds = children[nodeId] || [];
    if (childIds.length === 0) {
      const node = elements.find(el => el.id === nodeId);
      widths[nodeId] = (node?.size?.width || 120) + siblingSpacing;
      return widths[nodeId];
    }
    const childWidths = childIds.map(calculateWidth);
    widths[nodeId] = childWidths.reduce((sum, w) => sum + w, 0);
    return widths[nodeId];
  };

  roots.forEach(root => calculateWidth(root.id));

  // Position nodes
  const arranged = elements.map(el => ({ ...el }));
  const isHorizontal = direction === 'left-right' || direction === 'right-left';

  const positionNode = (nodeId, x, y, level) => {
    const nodeEl = arranged.find(el => el.id === nodeId);
    if (!nodeEl) return;

    const nodeWidth = nodeEl.size?.width || 120;
    const nodeHeight = nodeEl.size?.height || 60;

    if (isHorizontal) {
      nodeEl.x = startX + level * (nodeWidth + levelSpacing);
      nodeEl.y = y;
    } else {
      nodeEl.x = x;
      nodeEl.y = startY + level * (nodeHeight + levelSpacing);
    }

    const childIds = children[nodeId] || [];
    if (childIds.length > 0) {
      let childX = x;
      let childY = y;

      childIds.forEach(childId => {
        positionNode(childId, childX, childY, level + 1);
        if (isHorizontal) {
          childY += widths[childId];
        } else {
          childX += widths[childId];
        }
      });
    }
  };

  let currentX = startX;
  let currentY = startY;
  roots.forEach(root => {
    positionNode(root.id, currentX, currentY, 0);
    if (isHorizontal) {
      currentY += widths[root.id];
    } else {
      currentX += widths[root.id];
    }
  });

  return arranged;
}

// ============ EXPORT ============

const LayoutEngine = {
  LAYOUT_TYPES,
  findContainingZone,
  getZones,
  getCards,
  constrainToZone,
  applyLayoutConstraints,
  isValidHierarchyConnection,
  getAllowedChildTypes,
  autoArrangeInZones,
  autoLayoutTree,
  snapToGrid,
  getLayoutPreset,
  validateZoneCoverage,
  getZoneItemCounts,
  // Advanced auto-layout algorithms
  hierarchicalLayout,
  forceDirectedLayout,
  gridLayout,
  circularLayout,
  treeLayout,
};

export default LayoutEngine;
