// components/diagram-studio/validation/ValidationEngine.js
// Validation engine for running pack validators

import { useMemo, useCallback } from 'react';

// ============ VALIDATION ENGINE ============

export class ValidationEngine {
  constructor(packRegistry) {
    this.packRegistry = packRegistry;
  }

  /**
   * Run all validators for a diagram
   * @param {Object} diagram - { elements, connections, packId }
   * @param {string} level - Minimum level to include: 'error' | 'warn' | 'info'
   * @returns {ValidationResult[]} Array of validation results
   */
  validate(diagram, level = 'info') {
    const { elements = [], connections = [], packId } = diagram;
    const results = [];

    // Get pack validators
    const validators = this.packRegistry?.getValidators?.(packId) || [];

    // Run built-in validators
    const builtInResults = this.runBuiltInValidators(elements, connections);
    results.push(...builtInResults);

    // Run pack-specific validators
    for (const validator of validators) {
      try {
        const result = validator.validate(elements, connections);
        if (result) {
          const items = Array.isArray(result) ? result : [result];
          for (const item of items) {
            results.push({
              id: validator.id,
              name: validator.name,
              level: validator.level || 'warn',
              message: item.message,
              elementId: item.elementId,
            });
          }
        }
      } catch (err) {
        console.warn(`Validator ${validator.id} failed:`, err);
      }
    }

    // Filter by level
    const levelOrder = { error: 0, warn: 1, info: 2 };
    const minLevel = levelOrder[level] ?? 2;
    return results.filter(r => (levelOrder[r.level] ?? 2) <= minLevel);
  }

  /**
   * Run built-in validators (common across all packs)
   */
  runBuiltInValidators(elements, connections) {
    const results = [];

    // Check for orphan nodes (no connections)
    const connectedIds = new Set();
    connections.forEach(c => {
      connectedIds.add(c.sourceId);
      connectedIds.add(c.targetId);
    });

    const orphanNodes = elements.filter(
      el => !el.isContainer && !connectedIds.has(el.id)
    );
    if (orphanNodes.length > 0 && elements.length > 1) {
      for (const node of orphanNodes) {
        results.push({
          id: 'orphan-node',
          name: 'Orphan Node',
          level: 'info',
          message: `"${node.label || node.id}" has no connections`,
          elementId: node.id,
        });
      }
    }

    // Check for missing labels
    const unlabeled = elements.filter(
      el => !el.label?.trim() && el.type !== 'annotation' && el.type !== 'note'
    );
    for (const el of unlabeled) {
      results.push({
        id: 'missing-label',
        name: 'Missing Label',
        level: 'info',
        message: `Element has no label`,
        elementId: el.id,
      });
    }

    // Check for broken connections
    const elementIds = new Set(elements.map(e => e.id));
    const brokenConnections = connections.filter(
      c => !elementIds.has(c.sourceId) || !elementIds.has(c.targetId)
    );
    for (const conn of brokenConnections) {
      results.push({
        id: 'broken-connection',
        name: 'Broken Connection',
        level: 'error',
        message: `Connection references missing element`,
        elementId: conn.id,
      });
    }

    return results;
  }

  /**
   * Get summary of validation results
   */
  getSummary(results) {
    const summary = { errors: 0, warnings: 0, info: 0, total: 0 };
    for (const r of results) {
      summary.total++;
      if (r.level === 'error') summary.errors++;
      else if (r.level === 'warn') summary.warnings++;
      else summary.info++;
    }
    return summary;
  }

  /**
   * Check if diagram is valid (no errors)
   */
  isValid(diagram) {
    const results = this.validate(diagram, 'error');
    return results.length === 0;
  }
}

// ============ VALIDATION RESULT INTERFACE ============

/**
 * ValidationResult:
 * {
 *   id: string,        // Validator ID
 *   name: string,      // Validator name
 *   level: 'error' | 'warn' | 'info',
 *   message: string,   // Human-readable message
 *   elementId?: string, // Element ID if applicable
 * }
 */

// ============ REACT HOOK ============

export function useValidation(packRegistry, elements, connections, packId, level = 'warn') {
  const engine = useMemo(() => {
    return new ValidationEngine(packRegistry);
  }, [packRegistry]);

  const results = useMemo(() => {
    return engine.validate({ elements, connections, packId }, level);
  }, [engine, elements, connections, packId, level]);

  const summary = useMemo(() => {
    return engine.getSummary(results);
  }, [engine, results]);

  const isValid = useMemo(() => {
    return summary.errors === 0;
  }, [summary]);

  const getIssuesForElement = useCallback((elementId) => {
    return results.filter(r => r.elementId === elementId);
  }, [results]);

  return {
    results,
    summary,
    isValid,
    getIssuesForElement,
    validate: () => engine.validate({ elements, connections, packId }, level),
  };
}

// ============ VALIDATION PANEL COMPONENT ============

export function ValidationPanel({ results, onNavigate, className = '' }) {
  if (!results || results.length === 0) {
    return (
      <div className={`ds-validation-panel ${className}`}>
        <div className="ds-validation-empty">
          <div className="ds-validation-empty-icon">✓</div>
          <div className="ds-validation-empty-text">No issues found</div>
        </div>
      </div>
    );
  }

  const grouped = {
    error: results.filter(r => r.level === 'error'),
    warn: results.filter(r => r.level === 'warn'),
    info: results.filter(r => r.level === 'info'),
  };

  return (
    <div className={`ds-validation-panel ${className}`}>
      <div className="ds-validation-summary">
        {grouped.error.length > 0 && (
          <span className="ds-validation-badge error">
            {grouped.error.length} {grouped.error.length === 1 ? 'error' : 'errors'}
          </span>
        )}
        {grouped.warn.length > 0 && (
          <span className="ds-validation-badge warn">
            {grouped.warn.length} {grouped.warn.length === 1 ? 'warning' : 'warnings'}
          </span>
        )}
        {grouped.info.length > 0 && (
          <span className="ds-validation-badge info">
            {grouped.info.length} info
          </span>
        )}
      </div>

      <div className="ds-validation-list">
        {['error', 'warn', 'info'].map(level => (
          grouped[level].map(issue => (
            <div
              key={`${issue.id}-${issue.elementId || 'global'}`}
              className={`ds-validation-item ${level}`}
              onClick={() => issue.elementId && onNavigate?.(issue.elementId)}
              style={{ cursor: issue.elementId ? 'pointer' : 'default' }}
            >
              <span className="ds-validation-icon">
                {level === 'error' ? '✕' : level === 'warn' ? '⚠' : 'ℹ'}
              </span>
              <span className="ds-validation-message">{issue.message}</span>
            </div>
          ))
        ))}
      </div>
    </div>
  );
}

// ============ DEFAULT EXPORT ============

export default ValidationEngine;
