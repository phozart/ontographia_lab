// components/diagram-studio/LeftPalette.js
// Left sidebar with stencil search and pack management

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useDiagram, useDiagramSelection } from './DiagramContext';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';

// Pack metadata with friendly names and descriptions
const PACK_META = {
  'core': { name: 'Core', icon: '⬜', description: 'Basic shapes and frames' },
  'process-flow': { name: 'Process Flows', icon: '📊', description: 'Process diagrams, BPMN, flowcharts' },
  'sticky-notes': { name: 'Sticky Notes', icon: '📝', description: 'Quick notes and ideation' },
  'cld': { name: 'Causal Loop', icon: '🔁', description: 'System dynamics modeling' },
  'uml-class': { name: 'UML Class', icon: '📐', description: 'Class diagrams and OOP design' },
  'mind-map': { name: 'Mind Map', icon: '🧠', description: 'Mind mapping and brainstorming' },
  'product-design': { name: 'Product Design', icon: '🎨', description: 'Product and UX design' },
  'erd': { name: 'ERD', icon: '🗄️', description: 'Entity relationship diagrams' },
  'togaf': { name: 'TOGAF/ArchiMate', icon: '🏛️', description: 'Enterprise architecture' },
  'itil': { name: 'ITIL', icon: '⚙️', description: 'IT service management' },
  'capability-map': { name: 'Capability Map', icon: '🗺️', description: 'Business capability modeling' },
};

// ============ COMPONENT ============

export default function LeftPalette({
  packRegistry,
  profile,
  onStencilDragStart,
  onOpenStarterPacks,
  enabledPacks: enabledPacksProp,
  onEnabledPacksChange,
  className = '',
}) {
  const { elements, activePack, addElement, selectedStencil, setSelectedStencil, setActiveTool } = useDiagram();
  const [activeTab, setActiveTab] = useState('stencils');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPacks, setExpandedPacks] = useState({});
  const [showPackManager, setShowPackManager] = useState(false);
  const [packSearchTerm, setPackSearchTerm] = useState('');
  const packManagerRef = useRef(null);

  // Get all available pack IDs
  const allPackIds = useMemo(() => {
    if (!packRegistry?.getAll) return [];
    return packRegistry.getAll().map(pack => pack.id);
  }, [packRegistry]);

  // Use enabled packs from props (managed by parent with API persistence)
  const enabledPacks = enabledPacksProp || ['process-flow'];
  const setEnabledPacks = onEnabledPacksChange || (() => {});

  // Get all available packs with metadata
  const availablePacks = useMemo(() => {
    if (!packRegistry?.getAll) return [];
    return packRegistry.getAll().map(pack => ({
      id: pack.id,
      name: PACK_META[pack.id]?.name || pack.name || pack.id,
      icon: PACK_META[pack.id]?.icon || '📦',
      description: PACK_META[pack.id]?.description || '',
      stencilCount: pack.stencils?.length || 0,
    }));
  }, [packRegistry]);

  // Filter and sort packs for pack manager search (alphabetically)
  const filteredPacks = useMemo(() => {
    let packs = availablePacks;
    if (packSearchTerm) {
      const term = packSearchTerm.toLowerCase();
      packs = packs.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term)
      );
    }
    return packs.sort((a, b) => a.name.localeCompare(b.name));
  }, [availablePacks, packSearchTerm]);

  // Get stencils from enabled packs, organized by pack
  const stencilsByPack = useMemo(() => {
    if (!packRegistry) return {};
    const byPack = {};

    enabledPacks.forEach(packId => {
      const pack = packRegistry.get(packId);
      if (pack?.stencils) {
        const packName = PACK_META[packId]?.name || pack.name || packId;
        const packIcon = PACK_META[packId]?.icon || '📦';

        const groupedStencils = {};
        pack.stencils.forEach(stencil => {
          const group = stencil.group || 'Elements';
          if (!groupedStencils[group]) {
            groupedStencils[group] = [];
          }
          groupedStencils[group].push({
            ...stencil,
            packId,
            packName,
            packIcon,
          });
        });

        byPack[packId] = {
          packName,
          packIcon,
          stencils: pack.stencils.map(s => ({ ...s, packId, packName, packIcon })),
          groups: groupedStencils,
        };
      }
    });

    return byPack;
  }, [packRegistry, enabledPacks]);

  // All stencils flattened for search
  const allStencils = useMemo(() => {
    const stencils = [];
    Object.values(stencilsByPack).forEach(pack => {
      stencils.push(...pack.stencils);
    });
    return stencils;
  }, [stencilsByPack]);

  // Filter stencils based on search
  const filteredStencils = useMemo(() => {
    if (!searchTerm) return allStencils;
    const term = searchTerm.toLowerCase();
    return allStencils.filter(s =>
      s.name.toLowerCase().includes(term) ||
      s.id.toLowerCase().includes(term) ||
      s.group?.toLowerCase().includes(term) ||
      s.packName?.toLowerCase().includes(term)
    );
  }, [allStencils, searchTerm]);

  // Find matches in non-enabled packs (to show hint)
  const matchesInOtherPacks = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2 || !packRegistry) return [];
    const term = searchTerm.toLowerCase();
    const matches = [];

    allPackIds.forEach(packId => {
      if (enabledPacks.includes(packId)) return; // Skip enabled packs
      const pack = packRegistry.get(packId);
      if (!pack?.stencils) return;

      const matchCount = pack.stencils.filter(s =>
        s.name.toLowerCase().includes(term) ||
        s.id.toLowerCase().includes(term)
      ).length;

      if (matchCount > 0) {
        matches.push({
          packId,
          packName: PACK_META[packId]?.name || pack.name || packId,
          matchCount,
        });
      }
    });

    return matches.sort((a, b) => b.matchCount - a.matchCount);
  }, [searchTerm, packRegistry, allPackIds, enabledPacks]);

  // Initialize expanded packs - expand first enabled pack by default
  useEffect(() => {
    if (enabledPacks.length === 0) return;
    // Default: expand first enabled pack
    setExpandedPacks(prev => {
      // Only set default if no packs are expanded yet
      if (Object.keys(prev).length === 0) {
        return { [enabledPacks[0]]: true };
      }
      return prev;
    });
  }, [enabledPacks]);

  // Toggle pack expansion
  const togglePack = useCallback((packId) => {
    setExpandedPacks(prev => ({
      ...prev,
      [packId]: !prev[packId],
    }));
  }, []);

  // Enable a pack
  const enablePack = useCallback((packId) => {
    setEnabledPacks(prev => {
      if (prev.includes(packId)) return prev;
      return [...prev, packId];
    });
    // Auto-expand newly added pack
    setExpandedPacks(prev => ({ ...prev, [packId]: true }));
  }, [setEnabledPacks]);

  // Disable a pack
  const disablePack = useCallback((packId) => {
    setEnabledPacks(prev => {
      if (prev.length <= 1) return prev; // Keep at least one
      return prev.filter(id => id !== packId);
    });
  }, [setEnabledPacks]);

  // Handle stencil click
  const handleStencilClick = useCallback((stencil, addDirectly = false) => {
    const packId = stencil.packId || activePack;

    if (addDirectly) {
      const newElement = {
        type: stencil.id,
        packId,
        name: stencil.name,
        label: stencil.name,
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        size: stencil.defaultSize || { width: 120, height: 60 },
        color: stencil.color,
      };
      addElement(newElement);
      setShowAutocomplete(false);
      setSearchTerm('');
    } else {
      const isAlreadySelected = selectedStencil?.id === stencil.id && selectedStencil?.packId === packId;

      if (isAlreadySelected) {
        setSelectedStencil(null);
        setActiveTool('select');
      } else {
        setSelectedStencil({ ...stencil, packId });
        setActiveTool('draw');
      }
    }
  }, [activePack, addElement, selectedStencil, setSelectedStencil, setActiveTool]);

  // Handle drag start
  const handleDragStart = useCallback((e, stencil) => {
    const packId = stencil.packId || activePack;
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'stencil',
      stencilId: stencil.id,
      packId,
    }));
    e.dataTransfer.effectAllowed = 'copy';
    onStencilDragStart?.(stencil);
  }, [activePack, onStencilDragStart]);

  // Handle search input change
  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  // Handle keyboard (Escape to clear)
  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setSearchTerm('');
    }
  }, []);

  // Close pack manager when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (packManagerRef.current && !packManagerRef.current.contains(e.target)) {
        setShowPackManager(false);
        setPackSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showPalette = profile?.uiPolicy?.showLeftPalette !== false;
  const readOnly = profile?.editingPolicy?.readOnly;

  if (!showPalette) return null;

  return (
    <div className={`ds-palette ${className}`}>
      {/* Tabs */}
      <div className="ds-palette-tabs" style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
      }}>
        <button
          className={`ds-palette-tab ${activeTab === 'stencils' ? 'active' : ''}`}
          onClick={() => setActiveTab('stencils')}
          style={{
            flex: 1,
            padding: '10px',
            background: activeTab === 'stencils' ? 'var(--bg)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'stencils' ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === 'stencils' ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Stencils
        </button>
        <button
          className={`ds-palette-tab ${activeTab === 'outline' ? 'active' : ''}`}
          onClick={() => setActiveTab('outline')}
          style={{
            flex: 1,
            padding: '10px',
            background: activeTab === 'outline' ? 'var(--bg)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'outline' ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === 'outline' ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          Outline
        </button>
      </div>

      {/* Stencils Tab */}
      {activeTab === 'stencils' && (
        <div className="ds-stencils-tab" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Search + Add Pack Button */}
          <div style={{ padding: '12px', position: 'relative' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {/* Search Input */}
              <div style={{ position: 'relative', flex: 1 }}>
                <SearchIcon style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 18,
                  color: 'var(--text-muted)',
                }} />
                <input
                  type="text"
                  placeholder="Search stencils..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    fontSize: 13,
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--bg)',
                    color: 'var(--text)',
                  }}
                />
              </div>

              {/* Add Pack Button */}
              <div style={{ position: 'relative' }} ref={packManagerRef}>
                <button
                  onClick={() => setShowPackManager(!showPackManager)}
                  title="Add or remove stencil packs"
                  style={{
                    width: 40,
                    height: 40,
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: showPackManager ? 'var(--accent-soft)' : 'var(--bg)',
                    color: showPackManager ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AddIcon style={{ fontSize: 20 }} />
                </button>

                {/* Pack Manager Dropdown */}
                {showPackManager && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: -200,
                    width: 240,
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    zIndex: 100,
                  }}>
                    <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)' }}>
                      <input
                        type="text"
                        placeholder="Search packs..."
                        value={packSearchTerm}
                        onChange={(e) => setPackSearchTerm(e.target.value)}
                        autoFocus
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: 13,
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          background: 'var(--bg)',
                          color: 'var(--text)',
                        }}
                      />
                    </div>
                    <div style={{ maxHeight: 300, overflow: 'auto' }}>
                      {filteredPacks.map(pack => {
                        const isEnabled = enabledPacks.includes(pack.id);
                        return (
                          <div
                            key={pack.id}
                            onClick={() => isEnabled ? disablePack(pack.id) : enablePack(pack.id)}
                            style={{
                              padding: '10px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              cursor: enabledPacks.length === 1 && isEnabled ? 'not-allowed' : 'pointer',
                              background: isEnabled ? 'var(--accent-soft)' : 'transparent',
                              borderBottom: '1px solid var(--border)',
                              opacity: enabledPacks.length === 1 && isEnabled ? 0.6 : 1,
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: isEnabled ? 'var(--accent)' : 'var(--text)' }}>
                                {pack.name}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {pack.stencilCount} stencils
                              </div>
                            </div>
                            {isEnabled && (
                              <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 600 }}>✓</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{
                      padding: '8px 12px',
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      borderTop: '1px solid var(--border)',
                      background: 'var(--bg)',
                    }}>
                      {enabledPacks.length} of {availablePacks.length} packs enabled
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Collapsible Pack Groups */}
          <div className="ds-stencils" style={{ flex: 1, overflow: 'auto', overflowX: 'hidden', minHeight: 0, paddingBottom: 80 }}>
            {enabledPacks.map((packId) => {
              const packData = stencilsByPack[packId];
              if (!packData) return null;

              const isExpanded = expandedPacks[packId] || searchTerm.length > 0;
              const totalStencils = packData.stencils.length;

              const displayStencils = searchTerm
                ? packData.stencils.filter(s =>
                    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    s.group?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                : packData.stencils;

              if (searchTerm && displayStencils.length === 0) return null;

              return (
                <div key={packId} className="ds-pack-section">
                  {/* Pack Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--bg)',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <button
                      onClick={() => togglePack(packId)}
                      style={{
                        flex: 1,
                        padding: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text)',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{packData.packName}</span>
                        <span style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          fontWeight: 400,
                          background: 'var(--panel)',
                          padding: '2px 6px',
                          borderRadius: 10,
                        }}>
                          {totalStencils}
                        </span>
                      </span>
                      {isExpanded ? (
                        <ExpandLessIcon style={{ fontSize: 18, color: 'var(--text-muted)' }} />
                      ) : (
                        <ExpandMoreIcon style={{ fontSize: 18, color: 'var(--text-muted)' }} />
                      )}
                    </button>
                  </div>

                  {/* Pack Content */}
                  {isExpanded && (
                    <div className="ds-pack-content" style={{ padding: '8px' }}>
                      {Object.entries(packData.groups).map(([groupName, groupStencils]) => {
                        const displayGroupStencils = searchTerm
                          ? groupStencils.filter(s =>
                              s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              s.id.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                          : groupStencils;

                        if (displayGroupStencils.length === 0) return null;

                        return (
                          <div key={groupName} style={{ marginBottom: 12 }}>
                            {Object.keys(packData.groups).length > 1 && (
                              <div style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: 'var(--text-light)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                padding: '4px 8px',
                                marginBottom: 4,
                              }}>
                                {groupName}
                              </div>
                            )}

                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, 1fr)',
                              gap: 4,
                            }}>
                              {displayGroupStencils.map(stencil => {
                                const isSelected = selectedStencil?.id === stencil.id && selectedStencil?.packId === stencil.packId;
                                return (
                                  <div
                                    key={`${stencil.packId}-${stencil.id}`}
                                    className={`ds-stencil-item ${isSelected ? 'selected' : ''}`}
                                    onClick={() => !readOnly && handleStencilClick(stencil)}
                                    draggable={!readOnly}
                                    onDragStart={(e) => handleDragStart(e, stencil)}
                                    title={isSelected ? 'Click to deselect, or draw on canvas' : `Click to select: ${stencil.name}`}
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '10px 6px',
                                      borderRadius: 8,
                                      cursor: readOnly ? 'default' : 'pointer',
                                      background: isSelected ? 'var(--accent)' : 'var(--panel)',
                                      color: isSelected ? 'white' : 'var(--text)',
                                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                                      transition: 'all 0.15s ease',
                                    }}
                                  >
                                    <div style={{
                                      color: isSelected ? 'white' : (stencil.color || 'var(--text)'),
                                      width: 28,
                                      height: 28,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}>
                                      {stencil.icon ? (
                                        typeof stencil.icon === 'string' ? (
                                          <span style={{ fontSize: 22 }}>{stencil.icon}</span>
                                        ) : (
                                          <stencil.icon style={{ fontSize: 24 }} />
                                        )
                                      ) : (
                                        <StencilShape shape={stencil.shape} color={isSelected ? 'white' : stencil.color} />
                                      )}
                                    </div>
                                    <span style={{
                                      fontSize: 11,
                                      textAlign: 'center',
                                      lineHeight: 1.2,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      width: '100%',
                                    }}>
                                      {stencil.name}
                                    </span>
                                    {isSelected && (
                                      <span style={{
                                        fontSize: 9,
                                        opacity: 0.9,
                                        fontWeight: 600,
                                        background: 'rgba(255,255,255,0.2)',
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                      }}>
                                        DRAW
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Show hint about matches in other packs */}
            {searchTerm && matchesInOtherPacks.length > 0 && (
              <div style={{
                padding: '12px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg)',
              }}>
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  marginBottom: 8,
                }}>
                  Also found in:
                </div>
                {matchesInOtherPacks.map(pack => (
                  <button
                    key={pack.packId}
                    onClick={() => enablePack(pack.packId)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '8px 10px',
                      marginBottom: 4,
                      fontSize: 12,
                      textAlign: 'left',
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      cursor: 'pointer',
                      color: 'var(--text)',
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{pack.packName}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                      {pack.matchCount} match{pack.matchCount > 1 ? 'es' : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {enabledPacks.length === 0 && (
              <div style={{
                padding: 24,
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 13,
              }}>
                Click + to add stencil packs
              </div>
            )}
          </div>

          {/* Starter Pack Button - Fixed at Bottom */}
          <div style={{
            padding: '12px',
            borderTop: '1px solid var(--border)',
            background: 'var(--panel)',
            flexShrink: 0,
          }}>
            <button
              onClick={onOpenStarterPacks}
              style={{
                width: '100%',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, var(--accent) 0%, #0284c7 100%)',
                border: 'none',
                borderRadius: 8,
                color: 'white',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(14, 116, 163, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 116, 163, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(14, 116, 163, 0.3)';
              }}
            >
              <RocketLaunchIcon style={{ fontSize: 18 }} />
              Starter Packs
            </button>
          </div>
        </div>
      )}

      {/* Outline Tab */}
      {activeTab === 'outline' && (
        <div className="ds-outline-tab" style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          <OutlineTree elements={elements} packRegistry={packRegistry} />
        </div>
      )}
    </div>
  );
}

// ============ STENCIL SHAPE PREVIEW ============

function StencilShape({ shape, color }) {
  const size = 22;
  const fill = color || '#3b82f6';

  switch (shape) {
    case 'circle':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill={fill} opacity="0.2" stroke={fill} strokeWidth="2" />
        </svg>
      );
    case 'diamond':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <polygon points="12,2 22,12 12,22 2,12" fill={fill} opacity="0.2" stroke={fill} strokeWidth="2" />
        </svg>
      );
    case 'ellipse':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <ellipse cx="12" cy="12" rx="10" ry="6" fill={fill} opacity="0.2" stroke={fill} strokeWidth="2" />
        </svg>
      );
    case 'parallelogram':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <polygon points="4,18 8,6 20,6 16,18" fill={fill} opacity="0.2" stroke={fill} strokeWidth="2" />
        </svg>
      );
    case 'sticky':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <rect x="2" y="2" width="20" height="20" rx="2" fill={fill} opacity="0.8" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <rect x="2" y="4" width="20" height="16" rx="3" fill={fill} opacity="0.2" stroke={fill} strokeWidth="2" />
        </svg>
      );
  }
}

// ============ OUTLINE TREE ============

function OutlineTree({ elements, packRegistry }) {
  const { selectElement, isElementSelected } = useDiagramSelection();
  const [expandedFrames, setExpandedFrames] = useState({});

  if (elements.length === 0) {
    return (
      <div style={{
        padding: 20,
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: 13,
      }}>
        No elements on canvas
      </div>
    );
  }

  // Separate frames from other elements
  const frames = elements.filter(el => el.type === 'frame' || el.isFrame);
  const nonFrameElements = elements.filter(el => el.type !== 'frame' && !el.isFrame);

  // Find elements within each frame's bounds
  const getElementsInFrame = (frame) => {
    const frameSize = frame.size || { width: 600, height: 400 };
    const frameRight = frame.x + frameSize.width;
    const frameBottom = frame.y + frameSize.height;

    return nonFrameElements.filter(el => {
      const elSize = el.size || { width: 100, height: 60 };
      const elCenterX = el.x + elSize.width / 2;
      const elCenterY = el.y + elSize.height / 2;
      return elCenterX >= frame.x && elCenterX <= frameRight &&
             elCenterY >= frame.y && elCenterY <= frameBottom;
    });
  };

  // Get elements not in any frame
  const elementsInFrames = new Set();
  frames.forEach(frame => {
    getElementsInFrame(frame).forEach(el => elementsInFrames.add(el.id));
  });
  const freeElements = nonFrameElements.filter(el => !elementsInFrames.has(el.id));

  // Group free elements by type
  const byType = {};
  freeElements.forEach(el => {
    const type = el.type || 'Unknown';
    if (!byType[type]) byType[type] = [];
    byType[type].push(el);
  });

  const toggleFrame = (frameId) => {
    setExpandedFrames(prev => ({ ...prev, [frameId]: !prev[frameId] }));
  };

  return (
    <div>
      {/* Frames with their children */}
      {frames.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-light)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '4px 0',
            marginBottom: 4,
          }}>
            Frames
          </div>
          {frames.map(frame => {
            const isSelected = isElementSelected(frame.id);
            const isExpanded = expandedFrames[frame.id] !== false;
            const childElements = getElementsInFrame(frame);

            return (
              <div key={frame.id} style={{ marginBottom: 4 }}>
                {/* Frame header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: isSelected ? 'var(--accent-soft)' : 'var(--bg)',
                    color: isSelected ? 'var(--accent)' : 'var(--text)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFrame(frame.id); }}
                    style={{
                      width: 18,
                      height: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontSize: 10,
                    }}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                  <span
                    onClick={() => selectElement(frame.id)}
                    style={{ flex: 1, fontSize: 12, fontWeight: 500 }}
                  >
                    {frame.label || 'Untitled Frame'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {childElements.length}
                  </span>
                </div>

                {/* Frame children */}
                {isExpanded && childElements.length > 0 && (
                  <div style={{ marginLeft: 20, marginTop: 2 }}>
                    {childElements.map(el => {
                      const elSelected = isElementSelected(el.id);
                      return (
                        <div
                          key={el.id}
                          onClick={() => selectElement(el.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            background: elSelected ? 'var(--accent-soft)' : 'transparent',
                            color: elSelected ? 'var(--accent)' : 'var(--text)',
                            fontSize: 11,
                            marginBottom: 2,
                          }}
                        >
                          {el.label || el.name || el.type}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Other elements grouped by type */}
      {Object.entries(byType).map(([type, els]) => (
        <div key={type} style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-light)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '4px 0',
            marginBottom: 4,
          }}>
            {type} ({els.length})
          </div>
          {els.map(el => {
            const isSelected = isElementSelected(el.id);
            return (
              <div
                key={el.id}
                onClick={() => selectElement(el.id)}
                style={{
                  padding: '6px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: isSelected ? 'var(--accent-soft)' : 'transparent',
                  color: isSelected ? 'var(--accent)' : 'var(--text)',
                  fontSize: 12,
                  marginBottom: 2,
                }}
              >
                {el.label || el.name || 'Untitled'}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
