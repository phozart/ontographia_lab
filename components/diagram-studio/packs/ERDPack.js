// components/diagram-studio/packs/ERDPack.js
// Entity Relationship Diagram pack with fields, keys, and cardinality

// ============ STENCILS ============

const stencils = [
  // Entity
  {
    id: 'entity',
    name: 'Entity',
    description: 'Database entity/table with fields',
    group: 'Tables',
    shape: 'rect',
    icon: '▤',
    color: '#3b82f6',
    defaultSize: { width: 200, height: 160 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    compartments: ['name', 'fields', 'indexes'],
    properties: [
      { id: 'fields', label: 'Fields', type: 'fieldList' },
      { id: 'indexes', label: 'Indexes', type: 'list' },
      { id: 'schema', label: 'Schema', type: 'text', placeholder: 'public' },
      { id: 'engine', label: 'Engine', type: 'text', placeholder: 'InnoDB' },
    ],
  },
  // Weak Entity
  {
    id: 'weak-entity',
    name: 'Weak Entity',
    description: 'Entity dependent on another entity',
    group: 'Tables',
    shape: 'rect',
    icon: '▤▤',
    color: '#8b5cf6',
    defaultSize: { width: 200, height: 140 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    compartments: ['name', 'fields'],
    properties: [
      { id: 'fields', label: 'Fields', type: 'fieldList' },
      { id: 'partialKey', label: 'Partial Key', type: 'text' },
    ],
  },
  // View
  {
    id: 'view',
    name: 'View',
    description: 'Database view',
    group: 'Tables',
    shape: 'rect',
    icon: '⧉',
    color: '#06b6d4',
    defaultSize: { width: 180, height: 100 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'fields', label: 'Fields', type: 'list' },
      { id: 'query', label: 'Query', type: 'textarea' },
    ],
  },
  // Junction Table (for M:N)
  {
    id: 'junction',
    name: 'Junction Table',
    description: 'Junction table for many-to-many relationships',
    group: 'Tables',
    shape: 'rect',
    icon: '⊞',
    color: '#f59e0b',
    defaultSize: { width: 160, height: 100 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    compartments: ['name', 'fields'],
    properties: [
      { id: 'fields', label: 'Foreign Keys', type: 'fieldList' },
    ],
  },
  // Attribute (Chen notation)
  {
    id: 'attribute',
    name: 'Attribute',
    description: 'Entity attribute (Chen notation)',
    group: 'Chen Notation',
    shape: 'ellipse',
    icon: '○',
    color: '#22c55e',
    defaultSize: { width: 100, height: 50 },
    ports: [
      { id: 'center', position: 'center' },
    ],
    isContainer: false,
    properties: [
      { id: 'dataType', label: 'Data Type', type: 'text' },
      { id: 'isPrimaryKey', label: 'Primary Key', type: 'boolean' },
      { id: 'isMultivalued', label: 'Multivalued', type: 'boolean' },
      { id: 'isDerived', label: 'Derived', type: 'boolean' },
    ],
  },
  // Relationship (Chen notation)
  {
    id: 'relationship-chen',
    name: 'Relationship',
    description: 'Relationship diamond (Chen notation)',
    group: 'Chen Notation',
    shape: 'diamond',
    icon: '◇',
    color: '#ef4444',
    defaultSize: { width: 100, height: 80 },
    ports: [
      { id: 'top', position: 'top' },
      { id: 'right', position: 'right' },
      { id: 'bottom', position: 'bottom' },
      { id: 'left', position: 'left' },
    ],
    isContainer: false,
    properties: [
      { id: 'cardinality', label: 'Cardinality', type: 'text' },
    ],
  },
  // Note
  {
    id: 'erd-note',
    name: 'Note',
    description: 'Documentation note',
    group: 'Annotations',
    shape: 'rect',
    icon: '📝',
    color: '#fef3c7',
    defaultSize: { width: 150, height: 80 },
    ports: [],
    isContainer: false,
  },
];

// ============ CONNECTION TYPES ============

const connectionTypes = [
  // One-to-One
  {
    id: 'one-to-one',
    name: 'One to One (1:1)',
    description: 'One-to-one relationship',
    style: 'solid',
    arrowStart: 'one',
    arrowEnd: 'one',
    color: '#374151',
  },
  // One-to-Many
  {
    id: 'one-to-many',
    name: 'One to Many (1:N)',
    description: 'One-to-many relationship',
    style: 'solid',
    arrowStart: 'one',
    arrowEnd: 'many',
    color: '#374151',
  },
  // Many-to-One
  {
    id: 'many-to-one',
    name: 'Many to One (N:1)',
    description: 'Many-to-one relationship',
    style: 'solid',
    arrowStart: 'many',
    arrowEnd: 'one',
    color: '#374151',
  },
  // Many-to-Many
  {
    id: 'many-to-many',
    name: 'Many to Many (M:N)',
    description: 'Many-to-many relationship',
    style: 'solid',
    arrowStart: 'many',
    arrowEnd: 'many',
    color: '#374151',
  },
  // Zero-or-One
  {
    id: 'zero-or-one',
    name: 'Zero or One (0..1)',
    description: 'Optional one relationship',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'zero-one',
    color: '#374151',
  },
  // Zero-or-Many
  {
    id: 'zero-or-many',
    name: 'Zero or Many (0..*)',
    description: 'Optional many relationship',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'zero-many',
    color: '#374151',
  },
  // Identifying Relationship
  {
    id: 'identifying',
    name: 'Identifying Relationship',
    description: 'Identifying relationship (solid line)',
    style: 'solid',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#374151',
    strokeWidth: 2,
  },
  // Non-Identifying
  {
    id: 'non-identifying',
    name: 'Non-Identifying',
    description: 'Non-identifying relationship (dashed)',
    style: 'dashed',
    arrowStart: 'none',
    arrowEnd: 'none',
    color: '#6b7280',
  },
];

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
        const fields = el.data?.fields || [];
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
        const fields = el.data?.fields || [];
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

// ERD Entity Renderer with fields
function ERDEntityRenderer({ element, stencil, isSelected }) {
  const { label, data } = element;
  // Ensure fields and indexes are always arrays
  const fields = Array.isArray(data?.fields) ? data.fields : [];
  const indexes = Array.isArray(data?.indexes) ? data.indexes : [];
  const isWeakEntity = element.type === 'weak-entity';
  const isJunction = element.type === 'junction';
  const isView = element.type === 'view';

  // Get color from stencil
  const color = element.color || stencil?.color || '#3b82f6';

  return (
    <div className={`erd-entity-node ${isWeakEntity ? 'weak' : ''} ${isView ? 'view' : ''}`} style={{ borderColor: color }}>
      {/* Header */}
      <div className="erd-entity-header" style={{ backgroundColor: color }}>
        {isView && <span className="erd-entity-badge">VIEW</span>}
        {isJunction && <span className="erd-entity-badge">JUNCTION</span>}
        <span className="erd-entity-name">{label || 'Untitled'}</span>
      </div>

      {/* Fields section */}
      <div className="erd-entity-fields">
        {fields.length > 0 ? (
          fields.map((field, idx) => (
            <div key={idx} className={`erd-field ${field.isPrimaryKey ? 'pk' : ''} ${field.isForeignKey ? 'fk' : ''}`}>
              <span className="erd-field-icons">
                {field.isPrimaryKey && <span className="erd-pk-icon" title="Primary Key">🔑</span>}
                {field.isForeignKey && <span className="erd-fk-icon" title="Foreign Key">🔗</span>}
                {!field.isPrimaryKey && !field.isForeignKey && <span className="erd-field-spacer">•</span>}
              </span>
              <span className="erd-field-name">{field.name}</span>
              <span className="erd-field-type">{field.dataType}</span>
              {field.isNullable === false && <span className="erd-field-notnull" title="NOT NULL">*</span>}
            </div>
          ))
        ) : (
          <div className="erd-field empty">No fields defined</div>
        )}
      </div>

      {/* Indexes section (if present) */}
      {indexes.length > 0 && (
        <div className="erd-entity-indexes">
          {indexes.map((idx, i) => (
            <div key={i} className="erd-index">
              <span className="erd-index-icon">⇢</span>
              <span>{idx}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Chen notation attribute renderer
function ERDAttributeRenderer({ element, stencil }) {
  const isPk = element.data?.isPrimaryKey;
  const isMultivalued = element.data?.isMultivalued;
  const isDerived = element.data?.isDerived;
  const color = element.color || stencil?.color || '#22c55e';

  return (
    <div
      className={`erd-attribute-node ${isPk ? 'pk' : ''} ${isMultivalued ? 'multivalued' : ''} ${isDerived ? 'derived' : ''}`}
      style={{ borderColor: color }}
    >
      <span className={isPk ? 'underline' : ''}>{element.label}</span>
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
