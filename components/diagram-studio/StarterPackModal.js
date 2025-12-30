// components/diagram-studio/StarterPackModal.js
// Modal for selecting and applying starter pack templates

import { useState, useCallback } from 'react';
import CloseIcon from '@mui/icons-material/Close';

// ============ STARTER PACK DEFINITIONS ============

const STARTER_PACKS = [
  {
    id: 'process-flow-basic',
    name: 'Simple Process Flow',
    description: 'Start-to-end process with decision point',
    category: 'Process',
    packId: 'process-flow',
    thumbnail: '🔄',
    elements: [
      { type: 'start-event', label: 'Start', x: 100, y: 200, size: { width: 50, height: 50 } },
      { type: 'task', label: 'Step 1', x: 200, y: 185, size: { width: 140, height: 70 } },
      { type: 'exclusive-gateway', label: 'Decision?', x: 400, y: 195, size: { width: 60, height: 60 } },
      { type: 'task', label: 'Option A', x: 520, y: 100, size: { width: 140, height: 70 } },
      { type: 'task', label: 'Option B', x: 520, y: 270, size: { width: 140, height: 70 } },
      { type: 'end-event', label: 'End', x: 720, y: 200, size: { width: 50, height: 50 } },
    ],
    connections: [
      { sourceIdx: 0, targetIdx: 1, sourcePort: 'right', targetPort: 'left' },
      { sourceIdx: 1, targetIdx: 2, sourcePort: 'right', targetPort: 'left' },
      { sourceIdx: 2, targetIdx: 3, sourcePort: 'top', targetPort: 'left', label: 'Yes' },
      { sourceIdx: 2, targetIdx: 4, sourcePort: 'bottom', targetPort: 'left', label: 'No' },
      { sourceIdx: 3, targetIdx: 5, sourcePort: 'right', targetPort: 'top' },
      { sourceIdx: 4, targetIdx: 5, sourcePort: 'right', targetPort: 'bottom' },
    ],
    frame: { x: 50, y: 50, width: 770, height: 350, label: 'Process Flow' },
  },
  {
    id: 'cld-feedback-loop',
    name: 'Feedback Loop',
    description: 'Reinforcing or balancing feedback loop',
    category: 'System Dynamics',
    packId: 'cld',
    thumbnail: '🔁',
    elements: [
      { type: 'variable', label: 'Variable A', x: 100, y: 100, size: { width: 140, height: 50 } },
      { type: 'variable', label: 'Variable B', x: 350, y: 100, size: { width: 140, height: 50 } },
      { type: 'variable', label: 'Variable C', x: 350, y: 250, size: { width: 140, height: 50 } },
      { type: 'variable', label: 'Variable D', x: 100, y: 250, size: { width: 140, height: 50 } },
      { type: 'reinforcing-loop', label: 'R1', x: 225, y: 165, size: { width: 50, height: 50 } },
    ],
    connections: [
      { sourceIdx: 0, targetIdx: 1, label: '+' },
      { sourceIdx: 1, targetIdx: 2, label: '+' },
      { sourceIdx: 2, targetIdx: 3, label: '+' },
      { sourceIdx: 3, targetIdx: 0, label: '+' },
    ],
    frame: { x: 50, y: 50, width: 500, height: 300, label: 'Feedback Loop' },
  },
  {
    id: 'swimlane-process',
    name: 'Swimlane Process',
    description: 'Multi-department workflow with lanes',
    category: 'Process',
    packId: 'process-flow',
    thumbnail: '📊',
    elements: [
      { type: 'pool', label: 'Business Process', x: 50, y: 50, size: { width: 700, height: 350 } },
      { type: 'lane', label: 'Department A', x: 80, y: 80, size: { width: 640, height: 110 } },
      { type: 'lane', label: 'Department B', x: 80, y: 200, size: { width: 640, height: 110 } },
      { type: 'start-event', label: 'Start', x: 130, y: 110, size: { width: 50, height: 50 } },
      { type: 'task', label: 'Initial Task', x: 220, y: 100, size: { width: 120, height: 60 } },
      { type: 'task', label: 'Review', x: 220, y: 225, size: { width: 120, height: 60 } },
      { type: 'task', label: 'Finalize', x: 420, y: 100, size: { width: 120, height: 60 } },
      { type: 'end-event', label: 'End', x: 600, y: 225, size: { width: 50, height: 50 } },
    ],
    connections: [
      { sourceIdx: 3, targetIdx: 4, sourcePort: 'right', targetPort: 'left' },
      { sourceIdx: 4, targetIdx: 5, sourcePort: 'bottom', targetPort: 'top' },
      { sourceIdx: 5, targetIdx: 6, sourcePort: 'right', targetPort: 'bottom' },
      { sourceIdx: 6, targetIdx: 7, sourcePort: 'bottom', targetPort: 'top' },
    ],
    frame: null, // Pool acts as the frame
  },
  {
    id: 'mind-map-central',
    name: 'Mind Map',
    description: 'Central idea with branches',
    category: 'Brainstorming',
    packId: 'mind-map',
    thumbnail: '🧠',
    elements: [
      { type: 'central-idea', label: 'Main Topic', x: 300, y: 200, size: { width: 150, height: 80 } },
      { type: 'branch', label: 'Branch 1', x: 100, y: 80, size: { width: 120, height: 50 } },
      { type: 'branch', label: 'Branch 2', x: 520, y: 80, size: { width: 120, height: 50 } },
      { type: 'branch', label: 'Branch 3', x: 100, y: 320, size: { width: 120, height: 50 } },
      { type: 'branch', label: 'Branch 4', x: 520, y: 320, size: { width: 120, height: 50 } },
    ],
    connections: [
      { sourceIdx: 0, targetIdx: 1 },
      { sourceIdx: 0, targetIdx: 2 },
      { sourceIdx: 0, targetIdx: 3 },
      { sourceIdx: 0, targetIdx: 4 },
    ],
    frame: { x: 50, y: 30, width: 650, height: 390, label: 'Mind Map' },
  },
  {
    id: 'sticky-kanban',
    name: 'Kanban Board',
    description: 'To Do, In Progress, Done columns',
    category: 'Brainstorming',
    packId: 'sticky-notes',
    thumbnail: '📝',
    elements: [
      // Column headers (using annotations or stickies)
      { type: 'sticky-yellow', label: 'To Do', x: 100, y: 80, size: { width: 150, height: 40 } },
      { type: 'sticky-yellow', label: 'In Progress', x: 300, y: 80, size: { width: 150, height: 40 } },
      { type: 'sticky-yellow', label: 'Done', x: 500, y: 80, size: { width: 150, height: 40 } },
      // Sample tasks
      { type: 'sticky-blue', label: 'Task 1', x: 100, y: 150, size: { width: 150, height: 100 } },
      { type: 'sticky-blue', label: 'Task 2', x: 100, y: 270, size: { width: 150, height: 100 } },
      { type: 'sticky-green', label: 'Task 3', x: 300, y: 150, size: { width: 150, height: 100 } },
      { type: 'sticky-pink', label: 'Task 4', x: 500, y: 150, size: { width: 150, height: 100 } },
    ],
    connections: [],
    frame: { x: 50, y: 30, width: 650, height: 390, label: 'Kanban Board' },
  },
  {
    id: 'erd-basic',
    name: 'Entity Relationship',
    description: 'Basic database diagram',
    category: 'Database',
    packId: 'erd',
    thumbnail: '🗄️',
    elements: [
      { type: 'entity', label: 'User', x: 100, y: 150, size: { width: 150, height: 100 } },
      { type: 'entity', label: 'Order', x: 350, y: 150, size: { width: 150, height: 100 } },
      { type: 'entity', label: 'Product', x: 600, y: 150, size: { width: 150, height: 100 } },
    ],
    connections: [
      { sourceIdx: 0, targetIdx: 1, label: 'places', sourcePort: 'right', targetPort: 'left' },
      { sourceIdx: 1, targetIdx: 2, label: 'contains', sourcePort: 'right', targetPort: 'left' },
    ],
    frame: { x: 50, y: 100, width: 750, height: 200, label: 'Entity Relationship Diagram' },
  },
  {
    id: 'blank-canvas',
    name: 'Blank Canvas',
    description: 'Empty workspace with a frame',
    category: 'General',
    packId: 'process-flow',
    thumbnail: '⬜',
    elements: [],
    connections: [],
    frame: { x: 100, y: 100, width: 600, height: 400, label: 'Untitled Canvas' },
  },
];

// Group packs by category
const CATEGORIES = [...new Set(STARTER_PACKS.map(p => p.category))];

// ============ COMPONENT ============

export default function StarterPackModal({ isOpen, onClose, onApply }) {
  const [selectedPack, setSelectedPack] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');

  const handleApply = useCallback(() => {
    if (!selectedPack) return;
    onApply(selectedPack);
    onClose();
    setSelectedPack(null);
  }, [selectedPack, onApply, onClose]);

  const handleClose = useCallback(() => {
    onClose();
    setSelectedPack(null);
  }, [onClose]);

  const filteredPacks = activeCategory === 'All'
    ? STARTER_PACKS
    : STARTER_PACKS.filter(p => p.category === activeCategory);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }} onClick={handleClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90%',
          maxWidth: 800,
          maxHeight: '85vh',
          background: 'var(--panel)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>
              Starter Packs
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Choose a template to get started quickly
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 36,
              height: 36,
              border: 'none',
              borderRadius: 8,
              background: 'var(--bg)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CloseIcon style={{ fontSize: 20 }} />
          </button>
        </div>

        {/* Category Tabs */}
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto',
        }}>
          <button
            onClick={() => setActiveCategory('All')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 20,
              background: activeCategory === 'All' ? 'var(--accent)' : 'var(--bg)',
              color: activeCategory === 'All' ? 'white' : 'var(--text)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 20,
                background: activeCategory === cat ? 'var(--accent)' : 'var(--bg)',
                color: activeCategory === cat ? 'white' : 'var(--text)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Pack Grid */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: 24,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
          }}>
            {filteredPacks.map(pack => {
              const isSelected = selectedPack?.id === pack.id;
              return (
                <div
                  key={pack.id}
                  onClick={() => setSelectedPack(pack)}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--accent-soft)' : 'var(--bg)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    width: '100%',
                    height: 100,
                    background: 'var(--panel)',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                    fontSize: 40,
                  }}>
                    {pack.thumbnail}
                  </div>

                  {/* Info */}
                  <h3 style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    color: isSelected ? 'var(--accent)' : 'var(--text)',
                  }}>
                    {pack.name}
                  </h3>
                  <p style={{
                    margin: '4px 0 0',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    lineHeight: 1.4,
                  }}>
                    {pack.description}
                  </p>

                  {/* Category badge */}
                  <div style={{
                    marginTop: 8,
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: 'var(--border)',
                    fontSize: 10,
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                  }}>
                    {pack.category}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg)',
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {selectedPack ? (
              <>
                Selected: <strong style={{ color: 'var(--text)' }}>{selectedPack.name}</strong>
                {' '}({selectedPack.elements.length} elements)
              </>
            ) : (
              'Select a starter pack to add to your canvas'
            )}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleClose}
              style={{
                padding: '10px 20px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--panel)',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!selectedPack}
              style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: 8,
                background: selectedPack
                  ? 'linear-gradient(135deg, var(--accent) 0%, #0284c7 100%)'
                  : 'var(--border)',
                color: selectedPack ? 'white' : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 600,
                cursor: selectedPack ? 'pointer' : 'not-allowed',
                boxShadow: selectedPack ? '0 2px 8px rgba(14, 116, 163, 0.3)' : 'none',
              }}
            >
              Add to Canvas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { STARTER_PACKS };
