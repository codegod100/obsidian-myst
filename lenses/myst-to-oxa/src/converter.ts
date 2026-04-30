/**
 * Convert MyST AST nodes to OXA tree-model nodes.
 *
 * This implements the `dev.panproto.myst-to-oxa` lens as a TypeScript runtime.
 * The subsequent OXA tree → ATProto flat-model conversion is handled by
 * `oxaToAtproto()` inlined in the plugin.
 */

import type {
  MystDocument,
  MystBlock,
  MystInline,
  MystHeading,
  MystParagraph,
  MystCodeBlock,
  MystThematicBreak,
  MystBlockquote,
  MystImage,
  MystMathBlock,
  MystOrderedList,
  MystUnorderedList,
  MystDirective,
  MystRole,
  MystLink,
  OxaDocument,
  OxaBlock,
  OxaInline,
  OxaText,
  OxaBlockBase,
  OxaListItem,
  OxaLink,
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

    case "link": {
      const link = node as MystLink;
      const result: OxaLink = { type: "Link", target: link.target };
      if (link.children && link.children.length > 0) {
        result.children = convertInlines(link.children);
      }
      return result;
    }

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
    case "math":
      return { type: "InlineCode", value: role.content, language: "latex" } as OxaInline;
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

function convertBlockquote(node: MystBlockquote): OxaBlock {
  return {
    ...copyBlockBase(node),
    type: "Blockquote",
    children: convertBlocks(node.children),
  };
}

function convertImage(node: MystImage): OxaBlock {
  const result: OxaBlock = {
    ...copyBlockBase(node),
    type: "Image",
    src: node.src,
  };
  if (node.alt !== undefined) {
    result.alt = node.alt;
  }
  return result;
}

function convertMathBlock(node: MystMathBlock): OxaBlock {
  return {
    ...copyBlockBase(node),
    type: "Math",
    value: node.value,
  };
}

function convertOrderedList(node: MystOrderedList): OxaBlock {
  const result: OxaBlock = {
    ...copyBlockBase(node),
    type: "List",
    ordered: true,
    children: convertListItems(node.children),
  };
  if (node.startIndex !== undefined) {
    result.startIndex = node.startIndex;
  }
  return result;
}

function convertUnorderedList(node: MystUnorderedList): OxaBlock {
  return {
    ...copyBlockBase(node),
    type: "List",
    ordered: false,
    children: convertListItems(node.children),
  };
}

function convertListItems(items: MystBlock[]): OxaListItem[] {
  // Each MystListItem is a MystBlock with type "list_item"
  return items
    .filter((item): item is MystBlock & { type: "list_item"; children: MystBlock[] } => item.type === "list_item")
    .map((item) => ({
      ...copyBlockBase(item),
      type: "ListItem" as const,
      children: convertBlocks(item.children),
    }));
}

// Admonition directive names
const ADMONITION_NAMES = new Set([
  "note", "warning", "danger", "error", "tip", "important",
  "caution", "attention", "hint", "seealso", "admonition",
]);

function convertDirective(directive: MystDirective): OxaBlock | undefined {
  // Figure directive → Image
  if (directive.name === "figure") {
    const result: OxaBlock = {
      ...copyBlockBase(directive),
      type: "Image",
      src: directive.argument || "",
    };
    if (directive.options.alt) {
      result.alt = directive.options.alt;
    }
    // Body becomes caption; options preserved in data for round-trip
    const data: Record<string, unknown> = {};
    if (directive.body) {
      data.caption = directive.body;
    }
    // Store all options (except alt which has its own field) in data.options
    const opts = Object.entries(directive.options).filter(([k]) => k !== "alt");
    if (opts.length > 0) {
      data.options = Object.fromEntries(opts);
    }
    // Also keep flat option keys in data for backward compat with existing records
    for (const [key, value] of Object.entries(directive.options)) {
      if (key !== "alt") {
        data[key] = value;
      }
    }
    if (Object.keys(data).length > 0) {
      result.data = data;
    }
    return result;
  }

  // Admonition directives → OxaAdmonition
  if (ADMONITION_NAMES.has(directive.name)) {
    const result: OxaBlock = {
      ...copyBlockBase(directive),
      type: "Admonition",
      kind: directive.name,
    };
    if (directive.argument) {
      result.title = directive.argument;
    }
    // Preserve directive options in data for round-trip
    const opts = Object.entries(directive.options);
    if (opts.length > 0) {
      result.data = { ...result.data, options: directive.options };
    }
    // Use nested children if available, otherwise parse body as paragraph
    const children = directive.children;
    if (children && children.length > 0) {
      result.children = convertBlocks(children);
    } else if (directive.body) {
      result.children = [{
        type: "Paragraph",
        children: [{ type: "Text", value: directive.body } as OxaText],
      }];
    }
    return result;
  }

  // Code directives
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
      // Preserve directive name and options in data for round-trip
      const data: Record<string, unknown> = {};
      data.directiveName = directive.name;
      const opts = Object.entries(directive.options);
      if (opts.length > 0) {
        data.options = directive.options;
      }
      if (Object.keys(data).length > 0) {
        result.data = data;
      }
      return result;
    }
    case "math": {
      const result: OxaBlock = {
        type: "Math",
        value: directive.body,
      };
      // Preserve directive name and options in data for round-trip
      const data: Record<string, unknown> = {};
      data.directiveName = directive.name;
      const opts = Object.entries(directive.options);
      if (opts.length > 0) {
        data.options = directive.options;
      }
      if (Object.keys(data).length > 0) {
        result.data = data;
      }
      return result;
    }
    default: {
      // Unknown directives with children — convert as generic container
      const children = directive.children;
      if (children && children.length > 0) {
        const result: OxaBlock = {
          ...copyBlockBase(directive),
          type: "Admonition",
          kind: directive.name,
          title: directive.argument || undefined,
          children: convertBlocks(children),
        };
        // Preserve directive options and body in data for round-trip
        const data: Record<string, unknown> = {};
        const opts = Object.entries(directive.options);
        if (opts.length > 0) {
          data.options = directive.options;
        }
        if (directive.body) {
          data.body = directive.body;
        }
        if (Object.keys(data).length > 0) {
          result.data = data;
        }
        return result;
      }
      // Unknown directives with body only — convert as admonition with body paragraph
      if (directive.body) {
        const result: OxaBlock = {
          ...copyBlockBase(directive),
          type: "Admonition",
          kind: directive.name,
          title: directive.argument || undefined,
          children: [{
            type: "Paragraph",
            children: [{ type: "Text", value: directive.body } as OxaText],
          }],
        };
        // Preserve directive options and body in data for round-trip
        const data: Record<string, unknown> = {};
        const opts = Object.entries(directive.options);
        if (opts.length > 0) {
          data.options = directive.options;
        }
        data.body = directive.body;
        result.data = data;
        return result;
      }
      return undefined;
    }
  }
}

function convertBlocks(nodes: MystBlock[]): OxaBlock[] {
  const result: OxaBlock[] = [];
  for (const node of nodes) {
    const converted = convertBlock(node);
    if (converted !== undefined) {
      result.push(converted);
    }
  }
  return result;
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
    case "blockquote":
      return convertBlockquote(node);
    case "image":
      return convertImage(node);
    case "math_block":
      return convertMathBlock(node);
    case "ordered_list":
      return convertOrderedList(node);
    case "unordered_list":
      return convertUnorderedList(node);
    case "directive":
      return convertDirective(node);
    default:
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
  const children = convertBlocks(doc.children);

  const result: OxaDocument = {
    type: "Document",
    children,
  };

  if (doc.title !== undefined) {
    result.title = [{ type: "Text", value: doc.title } as OxaText];
  }

  if (doc.metadata !== undefined) {
    result.metadata = doc.metadata;
  }

  return result;
}
