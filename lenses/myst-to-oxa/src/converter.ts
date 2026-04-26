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
  OxaDocument,
  OxaBlock,
  OxaInline,
  OxaText,
  OxaBlockBase,
  OxaListItem,
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
    // Body becomes caption (stored as data for now)
    if (directive.body) {
      result.data = { caption: directive.body, ...directive.options };
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
    // Use nested children if available, otherwise parse body as paragraph
    const children = (directive as any).children;
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
      return result;
    }
    case "math": {
      return {
        type: "Math",
        value: directive.body,
      };
    }
    default: {
      // Unknown directives with children — convert as generic container
      const children = (directive as any).children;
      if (children && children.length > 0) {
        return {
          ...copyBlockBase(directive),
          type: "Admonition",
          kind: directive.name,
          title: directive.argument || undefined,
          children: convertBlocks(children),
        };
      }
      // Unknown directives with body only — convert as admonition with body paragraph
      if (directive.body) {
        return {
          ...copyBlockBase(directive),
          type: "Admonition",
          kind: directive.name,
          title: directive.argument || undefined,
          children: [{
            type: "Paragraph",
            children: [{ type: "Text", value: directive.body } as OxaText],
          }],
        };
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

  return result;
}
