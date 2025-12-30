// components/diagram-studio/templates/TemplateManager.js
// Template management for DiagramStudio

import { useState, useMemo, useCallback } from 'react';

// ============ TEMPLATE MANAGER ============

export class TemplateManager {
  constructor(packRegistry) {
    this.packRegistry = packRegistry;
    this.customTemplates = new Map(); // User-defined templates
  }

  /**
   * Get all templates for a pack
   */
  getTemplates(packId) {
    const pack = this.packRegistry?.get?.(packId);
    const packTemplates = pack?.templates || [];
    const custom = this.getCustomTemplates(packId);
    return [...packTemplates, ...custom];
  }

  /**
   * Get custom templates for a pack
   */
  getCustomTemplates(packId) {
    return this.customTemplates.get(packId) || [];
  }

  /**
   * Add a custom template
   */
  addCustomTemplate(packId, template) {
    const templates = this.customTemplates.get(packId) || [];
    templates.push({
      ...template,
      id: template.id || `custom_${Date.now()}`,
      isCustom: true,
      createdAt: new Date().toISOString(),
    });
    this.customTemplates.set(packId, templates);
  }

  /**
   * Remove a custom template
   */
  removeCustomTemplate(packId, templateId) {
    const templates = this.customTemplates.get(packId) || [];
    this.customTemplates.set(
      packId,
      templates.filter(t => t.id !== templateId)
    );
  }

  /**
   * Get a specific template
   */
  getTemplate(packId, templateId) {
    const templates = this.getTemplates(packId);
    return templates.find(t => t.id === templateId);
  }

  /**
   * Create diagram from template
   */
  createFromTemplate(packId, templateId) {
    const template = this.getTemplate(packId, templateId);
    if (!template) return null;

    // Deep clone elements and connections with new IDs
    const idMap = {};
    const elements = (template.elements || []).map(el => {
      const newId = `el_${Math.random().toString(36).substr(2, 9)}`;
      idMap[el.id] = newId;
      return {
        ...el,
        id: newId,
        packId: packId,
        createdAt: new Date().toISOString(),
      };
    });

    const connections = (template.connections || []).map(conn => ({
      ...conn,
      id: `conn_${Math.random().toString(36).substr(2, 9)}`,
      sourceId: idMap[conn.sourceId] || conn.sourceId,
      targetId: idMap[conn.targetId] || conn.targetId,
    }));

    return {
      name: template.name,
      type: packId,
      elements,
      connections,
      settings: template.settings || {},
    };
  }

  /**
   * Save current diagram as template
   */
  saveAsTemplate(diagram, name, description = '') {
    return {
      id: `tpl_${Date.now()}`,
      name,
      description,
      elements: diagram.elements || [],
      connections: diagram.connections || [],
      settings: diagram.settings || {},
      thumbnail: null,
      isCustom: true,
      createdAt: new Date().toISOString(),
    };
  }
}

// ============ TEMPLATE SELECTOR COMPONENT ============

export function TemplateSelector({
  packRegistry,
  packId,
  onSelect,
  onCancel,
  className = '',
}) {
  const [search, setSearch] = useState('');

  const templateManager = useMemo(() => {
    return new TemplateManager(packRegistry);
  }, [packRegistry]);

  const templates = useMemo(() => {
    const all = templateManager.getTemplates(packId);
    if (!search) return all;
    const term = search.toLowerCase();
    return all.filter(
      t => t.name.toLowerCase().includes(term) ||
           t.description?.toLowerCase().includes(term)
    );
  }, [templateManager, packId, search]);

  const handleSelect = useCallback((template) => {
    const diagram = templateManager.createFromTemplate(packId, template.id);
    onSelect?.(diagram, template);
  }, [templateManager, packId, onSelect]);

  return (
    <div className={`ds-template-selector ${className}`}>
      <div className="ds-template-header">
        <h3>Choose a Template</h3>
        <button
          className="ds-template-close"
          onClick={onCancel}
          title="Close"
        >
          ×
        </button>
      </div>

      <div className="ds-template-search">
        <input
          type="text"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            fontSize: 14,
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg)',
            color: 'var(--text)',
          }}
        />
      </div>

      <div className="ds-template-grid">
        {templates.map(template => (
          <div
            key={template.id}
            className="ds-template-card"
            onClick={() => handleSelect(template)}
          >
            <div className="ds-template-preview">
              {template.thumbnail ? (
                <img src={template.thumbnail} alt={template.name} />
              ) : (
                <div className="ds-template-preview-placeholder">
                  <span style={{ fontSize: 32, opacity: 0.3 }}>📊</span>
                </div>
              )}
            </div>
            <div className="ds-template-info">
              <div className="ds-template-name">{template.name}</div>
              {template.description && (
                <div className="ds-template-desc">{template.description}</div>
              )}
              {template.isCustom && (
                <span className="ds-template-badge">Custom</span>
              )}
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="ds-template-empty">
            <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }}>📄</div>
            <div>No templates found</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ SAVE AS TEMPLATE DIALOG ============

export function SaveTemplateDialog({
  diagram,
  onSave,
  onCancel,
  className = '',
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    const templateManager = new TemplateManager(null);
    const template = templateManager.saveAsTemplate(diagram, name.trim(), description.trim());
    onSave?.(template);
  };

  return (
    <div className={`ds-save-template-dialog ${className}`}>
      <div className="ds-dialog-header">
        <h3>Save as Template</h3>
        <button className="ds-dialog-close" onClick={onCancel}>×</button>
      </div>

      <div className="ds-dialog-content">
        <div className="ds-form-group">
          <label>Template Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Template"
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 14,
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--bg)',
              color: 'var(--text)',
            }}
          />
        </div>

        <div className="ds-form-group" style={{ marginTop: 16 }}>
          <label>Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this template is for..."
            rows={3}
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: 14,
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--bg)',
              color: 'var(--text)',
              resize: 'vertical',
            }}
          />
        </div>
      </div>

      <div className="ds-dialog-footer">
        <button
          onClick={onCancel}
          style={{
            padding: '10px 20px',
            fontSize: 14,
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--text)',
            cursor: 'pointer',
            marginRight: 12,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          style={{
            padding: '10px 20px',
            fontSize: 14,
            border: 'none',
            borderRadius: 8,
            background: name.trim() ? 'var(--accent)' : 'var(--border)',
            color: name.trim() ? 'white' : 'var(--text-muted)',
            cursor: name.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Save Template
        </button>
      </div>
    </div>
  );
}

// ============ REACT HOOK ============

export function useTemplates(packRegistry, packId) {
  const templateManager = useMemo(() => {
    return new TemplateManager(packRegistry);
  }, [packRegistry]);

  const templates = useMemo(() => {
    return templateManager.getTemplates(packId);
  }, [templateManager, packId]);

  const createFromTemplate = useCallback((templateId) => {
    return templateManager.createFromTemplate(packId, templateId);
  }, [templateManager, packId]);

  const saveAsTemplate = useCallback((diagram, name, description) => {
    return templateManager.saveAsTemplate(diagram, name, description);
  }, [templateManager]);

  return {
    templates,
    createFromTemplate,
    saveAsTemplate,
  };
}

// ============ DEFAULT EXPORT ============

export default TemplateManager;
