/**
 * Convert MyST AST nodes to OXA tree-model nodes.
 *
 * This implements the `dev.panproto.myst-to-oxa` lens as a TypeScript runtime.
 * The subsequent OXA tree → ATProto flat-model conversion is handled by
 * `@oxa/core`'s `oxaToAtproto()`.
 */

import type {
  MystDocument,
  MystBlock,
  MystInline,
  MystHeading,
  MystParagraph,
  MystCodeBlock,
  MystThematicBreak,
  MystDirective,
  MystRole,
  OxaDocument,
  OxaBlock,
  OxaInline,
  OxaText,
  OxaBlockBase,
} from "./types.js";

// ---------------------------------------------------------------------------
// Inline conversion
// ---------------------------------------------------------------------------

function convertInline(node: MystInline): OxaInline | undefined {
  switch (node.type) {
    case "text":
      return { type: "Text", value: node.value };

    case "strong":
      return {
        type: "Strong",
        children: convertInlines(node.children),
      };

    case "emphasis":
      return {
        type: "Emphasis",
        children: convertInlines(node.children),
      };

    case "inline_code":
      return { type: "InlineCode", value: node.value };

    case "role":
      return convertRole(node);

    default:
      return undefined;
  }
}

function convertInlines(nodes: MystInline[]): OxaInline[] {
  const result: OxaInline[] = [];
  for (const node of nodes) {
    const converted = convertInline(node);
    if (converted !== undefined) {
      result.push(converted);
    }
  }
  return result;
}

function convertRole(role: MystRole): OxaInline | undefined {
  switch (role.name) {
    case "code":
      return { type: "InlineCode", value: role.content };
    case "sup":
      return { type: "Superscript", children: [{ type: "Text", value: role.content } as OxaText] };
    case "sub":
      return { type: "Subscript", children: [{ type: "Text", value: role.content } as OxaText] };
    default:
      // Unknown role — render as plain text
      return { type: "Text", value: role.content };
  }
}

// ---------------------------------------------------------------------------
// Block conversion
// ---------------------------------------------------------------------------

function copyBlockBase(block: { id?: string; classes?: string[]; data?: Record<string, unknown> }): OxaBlockBase {
  const base: OxaBlockBase = {};
  if (block.id !== undefined) base.id = block.id;
  if (block.classes !== undefined) base.classes = block.classes;
  if (block.data !== undefined) base.data = block.data;
  return base;
}

function convertHeading(node: MystHeading): OxaBlock {
  return {
    ...copyBlockBase(node),
    type: "Heading",
    level: node.level,
    children: convertInlines(node.children),
  };
}

function convertParagraph(node: MystParagraph): OxaBlock {
  return {
    ...copyBlockBase(node),
    type: "Paragraph",
    children: convertInlines(node.children),
  };
}

function convertCodeBlock(node: MystCodeBlock): OxaBlock {
  const result: OxaBlock = {
    ...copyBlockBase(node),
    type: "Code",
    value: node.value,
  };
  if (node.language !== undefined) {
    result.language = node.language;
  }
  return result;
}

function convertThematicBreak(_node: MystThematicBreak): OxaBlock {
  return { type: "ThematicBreak" };
}

function convertDirective(directive: MystDirective): OxaBlock | undefined {
  switch (directive.name) {
    case "code-block":
    case "code-cell": {
      const result: OxaBlock = {
        type: "Code",
        value: directive.body,
      };
      if (directive.argument) {
        result.language = directive.argument;
      }
      return result;
    }
    default:
      // Unknown directive — drop
      return undefined;
  }
}

function convertBlock(node: MystBlock): OxaBlock | undefined {
  switch (node.type) {
    case "heading":
      return convertHeading(node);
    case "paragraph":
      return convertParagraph(node);
    case "code_block":
      return convertCodeBlock(node);
    case "thematic_break":
      return convertThematicBreak(node);
    case "directive":
      return convertDirective(node);
    default:
      // blockquote, image, math_block, ordered_list, unordered_list — drop
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Document conversion
// ---------------------------------------------------------------------------

/**
 * Convert a MyST document to an OXA tree-model document.
 *
 * @param doc - MyST document AST.
 * @returns OXA tree-model document.
 */
export function convertMystToOxa(doc: MystDocument): OxaDocument {
  const children: OxaBlock[] = [];

  for (const block of doc.children) {
    const converted = convertBlock(block);
    if (converted !== undefined) {
      children.push(converted);
    }
  }

  const result: OxaDocument = {
    type: "Document",
    children,
  };

  if (doc.title !== undefined) {
    result.title = [{ type: "Text", value: doc.title } as OxaText];
  }

  return result;
}
