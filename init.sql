-- Diagram Studio Database Schema
-- Dedicated database for diagram data with integrated user management

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS - User accounts with OAuth and approval workflow
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  image TEXT,
  provider VARCHAR(50),                          -- 'google' | 'github' | 'email'
  provider_id VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',               -- 'user' | 'admin'
  status VARCHAR(50) DEFAULT 'pending',          -- 'pending' | 'active' | 'suspended'

  -- Email/password authentication
  password_hash TEXT,
  email_verified BOOLEAN DEFAULT FALSE,

  -- Password reset
  reset_token TEXT,
  reset_token_expires TIMESTAMP WITH TIME ZONE,

  -- Terms and privacy acceptance
  accepted_terms BOOLEAN DEFAULT FALSE,
  accepted_terms_at TIMESTAMP WITH TIME ZONE,
  accepted_privacy BOOLEAN DEFAULT FALSE,
  accepted_privacy_at TIMESTAMP WITH TIME ZONE,

  -- Future subscription fields (prepared but not active)
  subscription_tier VARCHAR(50) DEFAULT 'free',  -- 'free' | 'pro' | 'enterprise'
  subscription_expires_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES users(id),
  last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- DIAGRAMS - Core diagram storage
-- ============================================================

CREATE TABLE IF NOT EXISTS diagrams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_id VARCHAR(20) UNIQUE,                     -- Human-readable ID (LAB-1, LAB-2, etc.)
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  description TEXT,
  content JSONB DEFAULT '{"nodes": [], "edges": [], "viewport": {"x": 0, "y": 0, "zoom": 1}}'::jsonb,
  thumbnail TEXT,
  tags TEXT[] DEFAULT '{}',
  is_template BOOLEAN DEFAULT false,
  domain_id UUID,
  project_id UUID,
  owner_id UUID REFERENCES users(id),            -- New: links to users table
  created_by VARCHAR(255) NOT NULL,              -- Keep for backward compatibility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Diagram versions for history/undo
CREATE TABLE IF NOT EXISTS diagram_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagram_id UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(diagram_id, version_number)
);

-- Diagram sharing (for collaboration)
CREATE TABLE IF NOT EXISTS diagram_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagram_id UUID NOT NULL REFERENCES diagrams(id) ON DELETE CASCADE,
  shared_with VARCHAR(255) NOT NULL,  -- Username or 'public'
  permission VARCHAR(50) DEFAULT 'view',  -- 'view', 'edit', 'admin'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(diagram_id, shared_with)
);

-- ============================================================
-- USER SETTINGS - Per-user preferences and settings
-- ============================================================

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email VARCHAR(255) UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_diagrams_type ON diagrams(type);
CREATE INDEX IF NOT EXISTS idx_diagrams_short_id ON diagrams(short_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_created_by ON diagrams(created_by);
CREATE INDEX IF NOT EXISTS idx_diagrams_owner ON diagrams(owner_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_domain ON diagrams(domain_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_project ON diagrams(project_id);
CREATE INDEX IF NOT EXISTS idx_diagram_versions_diagram ON diagram_versions(diagram_id);
CREATE INDEX IF NOT EXISTS idx_diagram_shares_diagram ON diagram_shares(diagram_id);
CREATE INDEX IF NOT EXISTS idx_diagram_shares_user ON diagram_shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_user_settings_email ON user_settings(user_email);

-- ============================================================
-- SAMPLE DATA
-- ============================================================

-- NOTE: Admin user should be created using the seed script:
-- npm run db:seed
-- This allows setting a proper password from environment variables.
-- See .env.example for ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME settings.

-- Sample diagrams
INSERT INTO diagrams (name, type, description, created_by, content) VALUES
  ('Sample BPMN Process', 'bpmn', 'Example business process diagram', 'admin',
   '{"nodes": [{"id": "start", "type": "bpmn-start", "position": {"x": 100, "y": 200}, "data": {"label": "Start"}}, {"id": "task1", "type": "bpmn-task", "position": {"x": 250, "y": 200}, "data": {"label": "Review Request"}}, {"id": "end", "type": "bpmn-end", "position": {"x": 450, "y": 200}, "data": {"label": "End"}}], "edges": [{"id": "e1", "source": "start", "target": "task1"}, {"id": "e2", "source": "task1", "target": "end"}], "viewport": {"x": 0, "y": 0, "zoom": 1}}'),
  ('Sample Mind Map', 'mindmap', 'Example mind map for brainstorming', 'admin',
   '{"nodes": [{"id": "root", "type": "mindmap-root", "position": {"x": 400, "y": 300}, "data": {"label": "Central Idea"}}, {"id": "branch1", "type": "mindmap-branch", "position": {"x": 600, "y": 200}, "data": {"label": "Branch 1"}}, {"id": "branch2", "type": "mindmap-branch", "position": {"x": 600, "y": 400}, "data": {"label": "Branch 2"}}], "edges": [{"id": "e1", "source": "root", "target": "branch1"}, {"id": "e2", "source": "root", "target": "branch2"}], "viewport": {"x": 0, "y": 0, "zoom": 1}}')
ON CONFLICT DO NOTHING;

-- ============================================================
-- MIGRATION: Add short_id column to existing databases
-- Run this if upgrading from a version without short_id:
-- ============================================================
-- ALTER TABLE diagrams ADD COLUMN IF NOT EXISTS short_id VARCHAR(20) UNIQUE;
-- CREATE INDEX IF NOT EXISTS idx_diagrams_short_id ON diagrams(short_id);
