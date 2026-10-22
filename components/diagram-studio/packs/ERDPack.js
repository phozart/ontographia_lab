// components/diagram-studio/packs/ERDPack.js
// Entity Relationship Diagram pack with fields, keys, and cardinality

import React, { useMemo } from 'react';
import { DiamondNode } from './CorePack';
import { normalizeFields, visibleRows, ERD_HEADER_H, ERD_ROW_H, ERD_INDEX_H } from './erdFields';
import { ElementText, SlotText } from '../text/useTextLayout';
import TextBlock, { OverflowBadge } from '../text/TextBlock';
import { layoutForSlot } from '../../../lib/text/fit';
import { stencils, connectionTypes } from './catalog/erd';

// ============ STENCILS ============


// ============ CONNECTION TYPES ============


// ============ VALIDATORS ============

const validators = [
  {
    id: 'entity-has-name',
    name: 'Entities Have Names',
    description: 'All entities should have a name',
    level: 'error',
    validate: (elements) => {
      const unnamed = elements.filter(
        el => el.type === 'entity' && !el.label?.trim()
      );
      if (unnamed.length > 0) {
        return unnamed.map(el => ({
          elementId: el.id,
          message: 'Entity must have a name',
        }));
      }
      return null;
    },
  },
  {
    id: 'entity-has-pk',
    name: 'Entities Have Primary Key',
    description: 'Each entity should have at least one primary key field',
    level: 'warning',
    validate: (elements) => {
      const withoutPk = elements.filter(el => {
        if (el.type !== 'entity') return false;
        const fields = normalizeFields(el.data?.fields);
        return !fields.some(f => f.isPrimaryKey);
      });
      if (withoutPk.length > 0) {
        return withoutPk.map(el => ({
          elementId: el.id,
          message: `Entity "${el.label}" has no primary key`,
        }));
      }
      return null;
    },
  },
  {
    id: 'fk-references-valid',
    name: 'Foreign Keys Reference Valid Tables',
    description: 'Foreign keys should reference existing tables',
    level: 'warning',
    validate: (elements) => {
      const entityNames = elements
        .filter(el => el.type === 'entity')
        .map(el => el.label?.toLowerCase());

      const errors = [];
      elements.forEach(el => {
        if (el.type !== 'entity') return;
        const fields = normalizeFields(el.data?.fields);
        fields.forEach(field => {
          if (field.isForeignKey && field.references?.table) {
            if (!entityNames.includes(field.references.table.toLowerCase())) {
              errors.push({
                elementId: el.id,
                message: `FK "${field.name}" references unknown table "${field.references.table}"`,
              });
            }
          }
        });
      });
      return errors.length > 0 ? errors : null;
    },
  },
];

// ============ TEMPLATES ============

const templates = [
  {
    id: 'blank',
    name: 'Blank ERD',
    description: 'Empty ERD diagram',
    thumbnail: null,
    elements: [],
    connections: [],
  },
  {
    id: 'user-management',
    name: 'User Management',
    description: 'Users and roles schema',
    thumbnail: null,
    elements: [
      {
        id: 'e1',
        type: 'entity',
        label: 'User',
        x: 100,
        y: 100,
        size: { width: 200, height: 180 },
        data: {
          fields: [
            { name: 'id', dataType: 'BIGINT', isPrimaryKey: true, isAutoIncrement: true },
            { name: 'email', dataType: 'VARCHAR(255)', isUnique: true, isNullable: false },
            { name: 'password_hash', dataType: 'VARCHAR(255)', isNullable: false },
            { name: 'first_name', dataType: 'VARCHAR(100)' },
            { name: 'last_name', dataType: 'VARCHAR(100)' },
            { name: 'created_at', dataType: 'TIMESTAMP' },
          ],
        },
      },
      {
        id: 'e2',
        type: 'entity',
        label: 'Role',
        x: 400,
        y: 100,
        size: { width: 180, height: 140 },
        data: {
          fields: [
            { name: 'id', dataType: 'INT', isPrimaryKey: true, isAutoIncrement: true },
            { name: 'name', dataType: 'VARCHAR(50)', isUnique: true },
            { name: 'description', dataType: 'TEXT' },
          ],
        },
      },
      {
        id: 'e3',
        type: 'junction',
        label: 'User_Role',
        x: 250,
        y: 320,
        size: { width: 160, height: 100 },
        data: {
          fields: [
            { name: 'user_id', dataType: 'BIGINT', isForeignKey: true, references: { table: 'User', column: 'id' } },
            { name: 'role_id', dataType: 'INT', isForeignKey: true, references: { table: 'Role', column: 'id' } },
          ],
        },
      },
    ],
    connections: [
      { id: 'c1', sourceId: 'e1', targetId: 'e3', type: 'one-to-many' },
      { id: 'c2', sourceId: 'e2', targetId: 'e3', type: 'one-to-many' },
    ],
  },
  {
    id: 'ecommerce',
    name: 'E-commerce Schema',
    description: 'Products, orders, customers',
    thumbnail: null,
    elements: [
      {
        id: 'e1',
        type: 'entity',
        label: 'Customer',
        x: 50,
        y: 50,
        size: { width: 200, height: 160 },
        data: {
          fields: [
            { name: 'id', dataType: 'BIGINT', isPrimaryKey: true },
            { name: 'email', dataType: 'VARCHAR(255)', isUnique: true },
            { name: 'name', dataType: 'VARCHAR(100)' },
            { name: 'phone', dataType: 'VARCHAR(20)' },
          ],
        },
      },
      {
        id: 'e2',
        type: 'entity',
        label: 'Order',
        x: 300,
        y: 50,
        size: { width: 200, height: 180 },
        data: {
          fields: [
            { name: 'id', dataType: 'BIGINT', isPrimaryKey: true },
            { name: 'customer_id', dataType: 'BIGINT', isForeignKey: true, references: { table: 'Customer', column: 'id' } },
            { name: 'order_date', dataType: 'TIMESTAMP' },
            { name: 'total', dataType: 'DECIMAL(10,2)' },
            { name: 'status', dataType: 'VARCHAR(20)' },
          ],
        },
      },
      {
        id: 'e3',
        type: 'entity',
        label: 'Product',
        x: 550,
        y: 250,
        size: { width: 200, height: 160 },
        data: {
          fields: [
            { name: 'id', dataType: 'BIGINT', isPrimaryKey: true },
            { name: 'sku', dataType: 'VARCHAR(50)', isUnique: true },
            { name: 'name', dataType: 'VARCHAR(200)' },
            { name: 'price', dataType: 'DECIMAL(10,2)' },
          ],
        },
      },
      {
        id: 'e4',
        type: 'entity',
        label: 'OrderItem',
        x: 300,
        y: 280,
        size: { width: 200, height: 160 },
        data: {
          fields: [
            { name: 'id', dataType: 'BIGINT', isPrimaryKey: true },
            { name: 'order_id', dataType: 'BIGINT', isForeignKey: true, references: { table: 'Order', column: 'id' } },
            { name: 'product_id', dataType: 'BIGINT', isForeignKey: true, references: { table: 'Product', column: 'id' } },
            { name: 'quantity', dataType: 'INT' },
            { name: 'unit_price', dataType: 'DECIMAL(10,2)' },
          ],
        },
      },
    ],
    connections: [
      { id: 'c1', sourceId: 'e1', targetId: 'e2', type: 'one-to-many', label: '1:N' },
      { id: 'c2', sourceId: 'e2', targetId: 'e4', type: 'one-to-many' },
      { id: 'c3', sourceId: 'e3', targetId: 'e4', type: 'one-to-many' },
    ],
  },
  {
    id: 'blog',
    name: 'Blog Schema',
    description: 'Posts, comments, tags',
    thumbnail: null,
    elements: [
      {
        id: 'e1',
        type: 'entity',
        label: 'Author',
        x: 50,
        y: 100,
        size: { width: 180, height: 140 },
        data: {
          fields: [
            { name: 'id', dataType: 'INT', isPrimaryKey: true },
            { name: 'username', dataType: 'VARCHAR(50)', isUnique: true },
            { name: 'email', dataType: 'VARCHAR(100)' },
            { name: 'bio', dataType: 'TEXT' },
          ],
        },
      },
      {
        id: 'e2',
        type: 'entity',
        label: 'Post',
        x: 300,
        y: 100,
        size: { width: 200, height: 160 },
        data: {
          fields: [
            { name: 'id', dataType: 'BIGINT', isPrimaryKey: true },
            { name: 'author_id', dataType: 'INT', isForeignKey: true, references: { table: 'Author', column: 'id' } },
            { name: 'title', dataType: 'VARCHAR(200)' },
            { name: 'content', dataType: 'TEXT' },
            { name: 'published_at', dataType: 'TIMESTAMP' },
          ],
        },
      },
      {
        id: 'e3',
        type: 'entity',
        label: 'Comment',
        x: 550,
        y: 100,
        size: { width: 180, height: 140 },
        data: {
          fields: [
            { name: 'id', dataType: 'BIGINT', isPrimaryKey: true },
            { name: 'post_id', dataType: 'BIGINT', isForeignKey: true },
            { name: 'author_name', dataType: 'VARCHAR(100)' },
            { name: 'content', dataType: 'TEXT' },
          ],
        },
      },
      {
        id: 'e4',
        type: 'entity',
        label: 'Tag',
        x: 300,
        y: 320,
        size: { width: 160, height: 100 },
        data: {
          fields: [
            { name: 'id', dataType: 'INT', isPrimaryKey: true },
            { name: 'name', dataType: 'VARCHAR(50)', isUnique: true },
          ],
        },
      },
    ],
    connections: [
      { id: 'c1', sourceId: 'e1', targetId: 'e2', type: 'one-to-many' },
      { id: 'c2', sourceId: 'e2', targetId: 'e3', type: 'one-to-many' },
      { id: 'c3', sourceId: 'e2', targetId: 'e4', type: 'many-to-many', label: 'M:N' },
    ],
  },
];

// ============ NODE PROPERTIES ============

const nodeProperties = [
  { id: 'documentation', label: 'Documentation', type: 'textarea' },
  { id: 'tablespace', label: 'Tablespace', type: 'text' },
  { id: 'charset', label: 'Character Set', type: 'text' },
];

// ============ CUSTOM RENDERERS ============

// Geometry of the entity card (px). The name header and every attribute row are text slots laid out by the shared module
// (ADR-0008 T2): the header holds the name (own font, up to 8 lines, the card's header grows with it), each row is two
// pinned mono 11 px blocks (name left, type right) that clamp with the badge, never cut silently.
const BADGE_COL = { view: 52, junction: 76 }; // the VIEW / JUNCTION tag at the left of the header (same numbers as the text policy)
const TYPE_SHARE = 0.4; // share of the row width the type column gets
const NAME_PAD_X = 12;

// The header of an entity: the name laid out in the header strip. Returns the layout and the header height, which grows
// with the number of name lines (a 1 or 2 line name fits the 40 px strip).
function useEntityHeader(element, label, innerW, badgeW, maxH) {
  const w = Math.max(20, innerW - 2 * NAME_PAD_X - badgeW);
  return useMemo(() => {
    const probe = layoutForSlot(element, { text: label, box: { x: 0, y: 0, width: w, height: 8 * 17.5 }, role: 'title', own: true, maxLines: 8, valign: 'top' });
    const need = Math.ceil(probe.layout.lines.length * probe.layout.lineHeight) + 12;
    const headerH = Math.min(Math.max(ERD_HEADER_H, need), Math.max(ERD_HEADER_H, maxH)); // never taller than the card leaves room for one row: a legacy small card clamps with the badge
    const box = { x: NAME_PAD_X + badgeW, y: 0, width: w, height: headerH };
    const { layout } = layoutForSlot(element, { text: label, box, role: 'title', own: true, maxLines: 8, valign: 'middle' });
    return { layout, box, headerH };
  }, [element, label, w, badgeW, maxH]);
}

// A field row: a pk/fk tinted strip with the key icons, then the name and the type as slots in the row
const BADGE_W = 18; // ONE overflow badge per row, in its own column at the right end of the row, never inside a text column
const probe = (element, text, width, align) => layoutForSlot(element, { text, box: { x: 0, y: 0, width, height: ERD_ROW_H }, role: 'meta', mono: true, align, maxLines: 1 }).layout;

// Column widths of a row: the name is the key information. Whole when both fit; otherwise the name takes what the type does
// not need but at least half of the row (or its measured width when smaller), and the TYPE is ellipsized first. The row is
// already at the 11 px minimum (role meta). A clamped row reserves the badge column.
function rowColumns(element, name, type, innerW) {
  const nameX = 10 + 20 + 6;
  const avail0 = innerW - nameX - 10 - 8;
  const nat = (t) => Math.ceil(probe(element, t, 2000, 'start').width) + 2;
  const nw = nat(name);
  const tw = type ? nat(type) : 0;
  if (nw + tw <= avail0) return { nameX, nameW: nw, typeW: tw, typeFull: tw, clamped: false, badgeX: 0 };
  const avail = avail0 - BADGE_W;
  const nameW = Math.max(40, Math.min(nw, Math.max(avail / 2, avail - tw)));
  const typeW = type ? Math.max(0, avail - nameW) : 0;
  return { nameX, nameW, typeW, typeFull: typeW, clamped: true, badgeX: innerW - 10 - BADGE_W };
}

// A field row: a pk/fk tinted strip with the key icons, then the name and the type as slots in the row
function FieldRow({ element, field, y, innerW }) {
  const keys = `${field.isPrimaryKey ? 'PK ' : ''}${field.isForeignKey ? 'FK ' : ''}`;
  const type = `${keys}${field.dataType || ''}${field.isNullable === false ? ' *' : ''}`.trim();
  const cols = rowColumns(element, field.name || '', type, innerW);
  const { nameX, nameW, typeW, typeFull } = cols;
  const typeX = cols.clamped ? innerW - 10 - BADGE_W - typeFull : innerW - 10 - typeFull;
  return (
    <div className={`erd-field ${field.isPrimaryKey ? 'pk' : ''} ${field.isForeignKey ? 'fk' : ''}`} style={{ top: y }}>
      <span className="erd-field-icons">
        {field.isPrimaryKey && <span className="erd-pk-icon" title="Primary Key">🔑</span>}
        {field.isForeignKey && <span className="erd-fk-icon" title="Foreign Key">🔗</span>}
        {!field.isPrimaryKey && !field.isForeignKey && <span className="erd-field-spacer">•</span>}
      </span>
      <SlotText element={element} text={field.name || ''} box={{ x: nameX, y: 0, width: nameW, height: ERD_ROW_H }} role="meta" mono align="start" maxLines={1} color="var(--text, #1f2937)" className="erd-cell" hideBadge testId="field" />
      <SlotText element={element} text={type} box={{ x: typeX, y: 0, width: typeW, height: ERD_ROW_H }} role="meta" mono align="end" maxLines={1} color="var(--text-muted, #6b7280)" className="erd-cell" hideBadge testId="field-type" />
      {cols.clamped && (
        <span className="erd-row-badge" style={{ left: cols.badgeX }}>
          <OverflowBadge text={`${field.name || ''}  ${type}`.trim()} />
        </span>
      )}
    </div>
  );
}

// ERD Entity Renderer with fields
function ERDEntityRenderer({ element, stencil }) {
  const { label, data } = element;
  // Ensure fields and indexes are always arrays
  // data.fields may be structured rows, legacy strings, or a free-text block
  const fields = normalizeFields(data?.fields);
  const indexes = Array.isArray(data?.indexes) ? data.indexes : [];
  const width = element.size?.width || stencil?.defaultSize?.width || 200;
  const height = element.size?.height || stencil?.defaultSize?.height || 160;
  const isWeakEntity = element.type === 'weak-entity';
  const isJunction = element.type === 'junction';
  const isView = element.type === 'view';
  const bw = isWeakEntity ? 4 : 2; // the card's border; slots are positioned inside it
  const innerW = width - 2 * bw;
  const badgeW = BADGE_COL[element.type] || 0;
  const header = useEntityHeader(element, label || 'Untitled', innerW, badgeW, height - 2 * bw - ERD_ROW_H - 12);
  const extra = header.headerH - ERD_HEADER_H; // a long name pushes the rows down
  const { shown, hidden } = visibleRows(height - extra, fields.length, indexes.length);

  // Get color from stencil
  const color = element.color || stencil?.color || '#3b82f6';
  const rowsTop = header.headerH + 6;
  const idxH = 8 + indexes.length * ERD_INDEX_H;

  return (
    <div className={`erd-entity-node ${isWeakEntity ? 'weak' : ''} ${isView ? 'view' : ''}`} style={{ borderColor: color }}>
      {/* Header: the name through the shared layout */}
      <div className="erd-entity-header" style={{ backgroundColor: color, height: header.headerH }}>
        {isView && <span className="erd-entity-badge">VIEW</span>}
        {isJunction && <span className="erd-entity-badge">JUNCTION</span>}
        <TextBlock layout={header.layout} box={header.box} color="#ffffff" fontFamily={element.fontFamily} fontStyle={element.fontStyle} textDecoration={element.textDecoration} testId="name" />
      </div>

      {/* Fields section */}
      {fields.length > 0 ? (
        fields.slice(0, shown).map((field, idx) => <FieldRow key={idx} element={element} field={field} y={rowsTop + idx * ERD_ROW_H} innerW={innerW} />)
      ) : (
        <div className="erd-field empty" style={{ top: rowsTop }}>
          <SlotText element={element} text="No fields defined" box={{ x: 10, y: 0, width: innerW - 20, height: ERD_ROW_H }} role="meta" align="center" maxLines={1} color="var(--text-muted, #6b7280)" testId="field" />
        </div>
      )}
      {hidden > 0 && (
        <div className="erd-field more" style={{ top: rowsTop + shown * ERD_ROW_H }}>
          <SlotText element={element} text={`+${hidden} more`} box={{ x: 36, y: 0, width: innerW - 46, height: ERD_ROW_H }} role="meta" align="start" maxLines={1} color="var(--text-muted, #6b7280)" testId="field" />
        </div>
      )}

      {/* Indexes section (if present) */}
      {indexes.length > 0 && (
        <div className="erd-entity-indexes" style={{ height: idxH }}>
          {indexes.map((idx, i) => (
            <div key={i} className="erd-index" style={{ top: 4 + i * ERD_INDEX_H }}>
              <span className="erd-index-icon">⇢</span>
              <SlotText element={element} text={String(idx)} box={{ x: 28, y: 0, width: Math.max(20, innerW - 38), height: ERD_INDEX_H }} role="meta" mono align="start" maxLines={1} color="var(--text-muted, #6b7280)" testId="index" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Chen notation attribute renderer (an ellipse; the label is the shared layout inside its inscribed rectangle)
function ERDAttributeRenderer({ element, stencil }) {
  const isPk = element.data?.isPrimaryKey;
  const isMultivalued = element.data?.isMultivalued;
  const isDerived = element.data?.isDerived;
  const color = element.color || stencil?.color || '#22c55e';
  const styled = useMemo(() => (isPk && !element.textDecoration ? { ...element, textDecoration: 'underline' } : element), [element, isPk]);

  return (
    <div
      className={`erd-attribute-node ${isPk ? 'pk' : ''} ${isMultivalued ? 'multivalued' : ''} ${isDerived ? 'derived' : ''}`}
      style={{ borderColor: color }}
    >
      <ElementText element={styled} stencil={stencil} packId="erd" text={element.label || ''} color={element.textColor || 'var(--text, #1f2937)'} offsetX={isMultivalued ? -4 : -2} offsetY={isMultivalued ? -4 : -2} />
    </div>
  );
}

// Main render function
function renderNode(element, stencil, isSelected) {
  switch (element.type) {
    case 'entity':
    case 'weak-entity':
    case 'junction':
    case 'view':
      return <ERDEntityRenderer element={element} stencil={stencil} isSelected={isSelected} />;
    case 'attribute':
      return <ERDAttributeRenderer element={element} stencil={stencil} />;
    case 'relationship-chen':
      // Chen relationship: SVG diamond on bbox midpoints (same renderer as Core diamond)
      return <DiamondNode element={element} stencil={stencil} isSelected={isSelected} outlined packId="erd" />;
    default:
      return null;
  }
}

// ============ PACK EXPORT ============

const ERDPack = {
  id: 'erd',
  name: 'Entity Relationship Diagram',
  description: 'Database design with entities, fields, and relationships',
  icon: '🗄️',
  stencils,
  connectionTypes,
  validators,
  templates,
  nodeProperties,
  renderNode,
  defaultLineStyle: 'step', // ERD uses orthogonal lines for relationships
};

export default ERDPack;
export { stencils, connectionTypes, validators, templates, nodeProperties };
