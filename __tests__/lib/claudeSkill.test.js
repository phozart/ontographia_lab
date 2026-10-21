/**
 * @jest-environment node
 */
// The Claude Agent Skill (skills/ontographia-lab) must stay valid and must not mention tools the MCP server lacks.

jest.mock('../../lib/db', () => ({ query: jest.fn() }));
jest.mock('../../lib/mcp/repository', () => ({ mcpRepository: {} }));

import fs from 'fs';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../../lib/mcp/server';

const DIR = path.join(__dirname, '..', '..', 'skills', 'ontographia-lab');

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(DIR).filter((f) => f.endsWith('.md'));

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const out = {};
  let key = null;
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z-]+):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      out[key] = kv[2];
    } else if (key) out[key] += ` ${line.trim()}`;
  }
  return out;
}

describe('ontographia-lab skill', () => {
  const skill = fs.readFileSync(path.join(DIR, 'SKILL.md'), 'utf8');

  test('frontmatter is valid', () => {
    const fm = frontmatter(skill);
    expect(fm).not.toBeNull();
    expect(fm.name).toBe('ontographia-lab');
    expect(fm.name).toBe(path.basename(DIR));
    expect(fm.name).toMatch(/^[a-z0-9-]{1,64}$/);
    expect(fm.description.trim().length).toBeGreaterThan(50);
    expect(fm.description.trim().length).toBeLessThanOrEqual(1024);
    expect(fm.description).not.toMatch(/[<>]/);
  });

  test('SKILL.md stays short and links existing files', () => {
    expect(skill.split('\n').length).toBeLessThanOrEqual(400);
    for (const m of skill.matchAll(/\]\((reference\/[^)#]+)\)/g)) {
      expect(fs.existsSync(path.join(DIR, m[1]))).toBe(true);
    }
  });

  test('every tool named in the skill exists on the server', async () => {
    const server = createMcpServer({ kind: 'agent', userId: 'u', tokenId: 't', roleCap: 'viewer', diagramScope: null });
    const client = new Client({ name: 'test', version: '1.0.0' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(st), client.connect(ct)]);
    const tools = new Set((await client.listTools()).tools.map((t) => t.name));
    const prompts = new Set((await client.listPrompts()).prompts.map((p) => p.name));

    const mentioned = new Set();
    for (const f of files) {
      for (const m of fs.readFileSync(f, 'utf8').matchAll(/`([a-z]+_[a-z_]+)`/g)) mentioned.add(m[1]);
    }
    // Backticked identifiers whose first segment is a tool family of this server must be real tools (or prompts).
    const families = new Set([...tools].map((t) => t.split('_')[0]));
    const unknown = [...mentioned].filter((n) => families.has(n.split('_')[0]) && !tools.has(n) && !prompts.has(n));
    expect(unknown).toEqual([]);
    for (const t of ['board_read_region', 'map_structure', 'layout_apply', 'diagram_apply_ops', 'diagram_show', 'guide_get', 'stencil_catalog']) {
      expect(mentioned.has(t)).toBe(true);
      expect(tools.has(t)).toBe(true);
    }
    for (const p of prompts) expect(mentioned.has(p)).toBe(true);
  });
});
