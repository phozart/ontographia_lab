// lib/mcp/structureTool.js
// MCP registration of map_structure, layout_apply, the canvas guide (resource + guide_get tool) and the verb prompts
// (AI-3; docs/architecture/investigations/ai-canvas-via-mcp.md 4.1/4.3). The tools only compile to ops: every write
// goes through the server's single `agentWrite` path (rate limit, authz + allowlist, CAS, version, audit).

import { z } from 'zod';
import { LAYOUTS } from '../layout/structureLayout';
import { compileMapStructure, compileLayoutApply, MAX_NODES, MAX_EDGES, MAX_GROUPS, MAX_LAYOUT_UNITS } from './structure';
import { GUIDE_TEXT, GUIDE_URI, GUIDE_VERSION, PROMPTS } from './guide';

const looseObj = z.object({}).passthrough();
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function registerStructureTools(server, { agentWrite, ok, wrap, diagramIdSchema, dataWarning }) {
  const layoutSchema = z.enum(LAYOUTS).describe('tree | radial | mindmap | cluster | flow | grid');

  server.registerTool(
    'map_structure',
    {
      title: 'Map a structure onto the canvas',
      description:
        'Build a mind map, hierarchy, flow, cluster or grid from a structure you worked out. Needs an editor token and a diagram on its allowlist. ' +
        'structure.nodes [{key, label?, stencil?: "pack/stencil", data?, group?, existingId?}], structure.edges [{from, to: node keys, label?}], structure.groups [{key, label}] (each group becomes a frame holding its members). ' +
        'existingId moves a note that is already on the board instead of creating a copy. layout: tree, radial, mindmap, cluster, flow or grid; the server computes positions (no overlaps, nothing else moves). ' +
        'anchor (optional): {near: elementId} | {at: {x, y}} | {inFrame: frameId}; default is free space right of existing content. Pass baseRevision from your last read; on a conflict nothing is written. ' +
        `Limits: ${MAX_NODES} nodes, ${MAX_EDGES} edges, ${MAX_GROUPS} groups per call. One call is one saved version the owner can restore. Returns created ids by key, the new revision and a summary. Read the guide (guide_get) once for conventions. ` +
        dataWarning,
      inputSchema: {
        id: diagramIdSchema,
        baseRevision: z.number().int().min(0).describe('The diagram revision you based this on (from diagram_get or board_read_region)'),
        structure: z
          .object({ nodes: z.array(looseObj).max(1000), edges: z.array(looseObj).max(2000).optional(), groups: z.array(looseObj).max(200).optional() })
          .passthrough(),
        layout: layoutSchema,
        anchor: looseObj.optional(),
      },
      annotations: { title: 'Map a structure onto the canvas', ...WRITE },
    },
    wrap(async ({ id, baseRevision, structure, layout, anchor }) => {
      const w = await agentWrite({
        id,
        baseRevision,
        rejectCode: 'INVALID_STRUCTURE',
        tool: 'map_structure',
        compute: (content) => compileMapStructure(content, { structure, layout, anchor }),
      });
      if (w.response) return w.response;
      const r = w.outcome.result;
      const result = {
        revision: Number(w.outcome.row.revision),
        versionId: w.outcome.versionId,
        created: r.created,
        groups: r.groups,
        summary: r.summary,
        counts: r.counts,
      };
      if (r.warnings.length) result.warnings = r.warnings;
      return ok(result);
    })
  );

  server.registerTool(
    'layout_apply',
    {
      title: 'Re-arrange existing elements',
      description:
        'Re-layout elements that are already on the canvas (positions only; labels, sizes and connections are untouched). Needs an editor token and a diagram on its allowlist. ' +
        `target: {frameId} lays out that frame's direct members inside it (the frame grows if they do not fit) or {elementIds: [...]} (up to ${MAX_LAYOUT_UNITS}; a frame moves with its contents). ` +
        'layout: tree, radial, mindmap, flow, grid (cluster = grid here); connections drive the hierarchical ones. anchor (elementIds only): {near} or {at: {x, y}}; by default the elements stay where they are, moved aside only if blocked. ' +
        'Pass baseRevision; one call is one saved version. Returns the new revision and how many elements moved. ' + dataWarning,
      inputSchema: {
        id: diagramIdSchema,
        baseRevision: z.number().int().min(0),
        target: looseObj,
        layout: layoutSchema,
        anchor: looseObj.optional(),
      },
      annotations: { title: 'Re-arrange existing elements', ...WRITE },
    },
    wrap(async ({ id, baseRevision, target, layout, anchor }) => {
      const w = await agentWrite({
        id,
        baseRevision,
        rejectCode: 'INVALID_STRUCTURE',
        tool: 'layout_apply',
        compute: (content) => compileLayoutApply(content, { target, layout, anchor }),
      });
      if (w.response) return w.response;
      const r = w.outcome.result;
      const result = { revision: Number(w.outcome.row.revision), versionId: w.outcome.versionId, moved: r.moved, summary: r.summary };
      if (r.warnings.length) result.warnings = r.warnings;
      return ok(result);
    })
  );

  // ---- the guide: a resource, and a tool for hosts that ignore resources ----
  server.registerResource(
    'canvas-guide',
    GUIDE_URI,
    { title: 'Canvas guide', description: 'How to read a board, think, and build with map_structure and layout_apply. Static.', mimeType: 'text/markdown' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: GUIDE_TEXT }] })
  );
  server.registerTool(
    'guide_get',
    {
      title: 'Canvas guide',
      description: 'The workflow guide (same text as the resource ontographia://guide/canvas): read region, think, map_structure; stencil conventions; limits. Static; read it once per session.',
      inputSchema: {},
      annotations: { title: 'Canvas guide', ...READ_ONLY },
    },
    wrap(async () => ({ content: [{ type: 'text', text: GUIDE_TEXT }], structuredContent: { version: GUIDE_VERSION, uri: GUIDE_URI } }))
  );

  // ---- verb prompts (user-invoked, persona-neutral; each only pre-fills "read this, then use these tools") ----
  server.registerPrompt(
    'cluster_region',
    {
      title: PROMPTS.cluster_region.title,
      description: PROMPTS.cluster_region.description,
      argsSchema: { link: z.string().max(500).describe('Link from "Copy link for Claude" in the editor'), theme: z.string().max(200).optional().describe('What to group by, for example sentiment or user need') },
    },
    ({ link, theme }) => ({ messages: [{ role: 'user', content: { type: 'text', text: PROMPTS.cluster_region.build(link, theme) } }] })
  );
  server.registerPrompt(
    'summarize_region',
    {
      title: PROMPTS.summarize_region.title,
      description: PROMPTS.summarize_region.description,
      argsSchema: { link: z.string().max(500).describe('Link from "Copy link for Claude" in the editor'), focus: z.string().max(200).optional().describe('What the summary should concentrate on') },
    },
    ({ link, focus }) => ({ messages: [{ role: 'user', content: { type: 'text', text: PROMPTS.summarize_region.build(link, focus) } }] })
  );
  server.registerPrompt(
    'map_from_text',
    {
      title: PROMPTS.map_from_text.title,
      description: PROMPTS.map_from_text.description,
      argsSchema: { diagramId: z.string().max(60).describe('Diagram id or LAB-n'), layout: z.enum(['mindmap', 'tree', 'flow', 'radial']).optional() },
    },
    ({ diagramId, layout }) => ({ messages: [{ role: 'user', content: { type: 'text', text: PROMPTS.map_from_text.build(diagramId, layout) } }] })
  );
}
