/**
 * Convert OXA tree-model nodes back to MyST AST nodes.
 *
 * This implements the inverse (backward) direction of the
 * `dev.panproto.myst-to-oxa` lens as a TypeScript runtime.
 *
 * The inverse of each lens step:
 *   - Sort renames → swap old/new
 *   - merge_sorts (ordered_list + unordered_list → List) → split on `ordered` field
 *   - coerce_sort (role → InlineCode, retraction) → reconstruct role from language
 *   - Field renames → swap old/new
 *   - add_field (language) → drop the field
 *   - remove_field (options) → add with empty default
 *
 * Note: the role→InlineCode coercion is a retraction, not an isomorphism.
 * InlineCode nodes without a known language tag are reconstructed as
 * plain inline_code, not as a role. Only `language: "latex"` is
 * reconstructed as a `{math}` role.
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
  MystListItem,
  MystDirective,
  MystRole,
  MystText,
  MystStrong,
  MystEmphasis,
  MystInlineCode,
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
// Inline conversion (OXA → MyST)
// ---------------------------------------------------------------------------

function invertInline(node: OxaInline): MystInline | undefined {
  switch (node.type) {
    case "Text":
      return { type: "text", value: (node as OxaText).value };

    case "Strong":
      return {
        type: "strong",
        children: invertInlines((node as { children: OxaInline[] }).children),
      };

    case "Emphasis":
      return {
        type: "emphasis",
        children: invertInlines((node as { children: OxaInline[] }).children),
      };

    case "InlineCode": {
      const code = node as { type: "InlineCode"; value: string; language?: string };
      // Inverse of coerce_sort: role → InlineCode (retraction)
      // language="latex" → {math} role
      if (code.language === "latex") {
        return { type: "role", name: "math", content: code.value };
      }
      // Other InlineCode stays as inline_code (no role reconstruction)
      return { type: "inline_code", value: code.value };
    }

    case "Superscript": {
      const children = (node as { children: OxaInline[] }).children;
      // Reconstruct as {sup} role if single Text child
      if (children.length === 1 && children[0].type === "Text") {
        return { type: "role", name: "sup", content: (children[0] as OxaText).value };
      }
      return { type: "text", value: children.map(extractText).join("") };
    }

    case "Subscript": {
      const children = (node as { children: OxaInline[] }).children;
      if (children.length === 1 && children[0].type === "Text") {
        return { type: "role", name: "sub", content: (children[0] as OxaText).value };
      }
      return { type: "text", value: children.map(extractText).join("") };
    }

    case "Link": {
      const link = node as OxaLink;
      const result: MystLink = { type: "link", target: link.target };
      if (link.children && link.children.length > 0) {
        result.children = invertInlines(link.children);
      }
      return result;
    }

    default:
      return undefined;
  }
}

function invertInlines(nodes: OxaInline[]): MystInline[] {
  const result: MystInline[] = [];
  for (const node of nodes) {
    const inverted = invertInline(node);
    if (inverted !== undefined) {
      result.push(inverted);
    }
  }
  return result;
}

function extractText(node: OxaInline): string {
  if (node.type === "Text") return (node as OxaText).value;
  if ("children" in node) {
    return ((node as { children: OxaInline[] }).children as OxaInline[]).map(extractText).join("");
  }
  if ("value" in node) return (node as { value: string }).value;
  return "";
}

// ---------------------------------------------------------------------------
// Block conversion (OXA → MyST)
// ---------------------------------------------------------------------------

function copyMystBlockBase(block: OxaBlockBase): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  if (block.id !== undefined) base.id = block.id;
  if (block.classes !== undefined) base.classes = block.classes;
  // Don't copy data wholesale — it's used for round-trip metadata (options)
  // that is explicitly restored by the inverse functions
  return base;
}

function invertHeading(node: OxaBlock & { level: number; children: OxaInline[] }): MystHeading {
  return {
    ...copyMystBlockBase(node),
    type: "heading",
    level: node.level,
    children: invertInlines(node.children),
  };
}

function invertParagraph(node: OxaBlock & { children: OxaInline[] }): MystParagraph {
  return {
    ...copyMystBlockBase(node),
    type: "paragraph",
    children: invertInlines(node.children),
  };
}

function invertCode(node: OxaBlock & { value: string; language?: string; data?: Record<string, unknown> }): MystDirective | MystCodeBlock {
  // If the code block came from a directive, reconstruct as directive
  const options = node.data?.options as Record<string, string> | undefined;
  const directiveName = node.data?.directiveName as string | undefined;
  if (directiveName && directiveName !== "code-block") {
    // Non-default directive name (e.g. code-cell) — always reconstruct as directive
    return {
      type: "directive",
      name: directiveName,
      argument: node.language ?? "",
      options: options ?? {},
      body: node.value,
    };
  }
  if (options && Object.keys(options).length > 0) {
    return {
      type: "directive",
      name: directiveName ?? "code-block",
      argument: node.language ?? "",
      options,
      body: node.value,
    };
  }
  const result: MystCodeBlock = {
    ...copyMystBlockBase(node),
    type: "code_block",
    value: node.value,
  };
  if (node.language !== undefined) {
    result.language = node.language;
  }
  return result;
}

function invertThematicBreak(_node: OxaBlock): MystThematicBreak {
  return { type: "thematic_break" };
}

function invertBlockquote(node: OxaBlock & { children: OxaBlock[] }): MystBlockquote {
  return {
    ...copyMystBlockBase(node),
    type: "blockquote",
    children: invertBlocks(node.children),
  };
}

function invertImage(node: OxaBlock & { src: string; alt?: string }): MystImage {
  const result: MystImage = {
    ...copyMystBlockBase(node),
    type: "image",
    src: node.src,
  };
  if (node.alt !== undefined) {
    result.alt = node.alt;
  }
  return result;
}

function invertMath(node: OxaBlock & { value: string; data?: Record<string, unknown> }): MystDirective | MystMathBlock {
  // If the math block came from a directive with options, reconstruct as directive
  const options = node.data?.options as Record<string, string> | undefined;
  const directiveName = node.data?.directiveName as string | undefined;
  if (options && Object.keys(options).length > 0) {
    return {
      type: "directive",
      name: directiveName ?? "math",
      argument: "",
      options,
      body: node.value,
    };
  }
  return {
    ...copyMystBlockBase(node),
    type: "math_block",
    value: node.value,
  };
}

// Inverse of merge_sorts: List → ordered_list or unordered_list
function invertList(node: OxaBlock & { ordered: boolean; startIndex?: number; children: OxaListItem[] }): MystOrderedList | MystUnorderedList {
  const items = invertListItems(node.children);
  if (node.ordered) {
    const result: MystOrderedList = {
      ...copyMystBlockBase(node),
      type: "ordered_list",
      children: items,
    };
    if (node.startIndex !== undefined) {
      result.startIndex = node.startIndex;
    }
    return result;
  }
  return {
    ...copyMystBlockBase(node),
    type: "unordered_list",
    children: items,
  };
}

function invertListItems(items: OxaListItem[]): MystListItem[] {
  return items.map((item) => ({
    ...copyMystBlockBase(item),
    type: "list_item" as const,
    children: invertBlocks(item.children),
  }));
}

// Inverse of directive → admonition conversion
const ADMONITION_NAMES = new Set([
  "note", "warning", "danger", "error", "tip", "important",
  "caution", "attention", "hint", "seealso", "admonition",
]);

function invertAdmonition(node: OxaBlock & { kind: string; title?: string; children: OxaBlock[]; data?: Record<string, unknown> }): MystDirective {
  const kind = node.kind;
  const options = (node.data?.options as Record<string, string>) ?? {};

  // Code directives: if kind is "code-block" or "code-cell"
  if (kind === "code-block" || kind === "code-cell") {
    const body = node.children.length === 1 && node.children[0].type === "Paragraph"
      ? extractBodyText(node.children[0])
      : "";
    return {
      type: "directive",
      name: kind,
      argument: node.title ?? "",
      options,
      body,
    };
  }

  // Math directive
  if (kind === "math") {
    const body = node.children.length === 1 && node.children[0].type === "Paragraph"
      ? extractBodyText(node.children[0])
      : "";
    return {
      type: "directive",
      name: "math",
      argument: "",
      options,
      body,
    };
  }

  // Figure directive (Image with data.caption)
  // This is handled in invertBlock for Image type

  // Standard admonitions
  if (ADMONITION_NAMES.has(kind)) {
    const result: MystDirective = {
      ...copyMystBlockBase(node),
      type: "directive",
      name: kind,
      argument: node.title ?? "",
      options,
      body: "",
    };
    // If children are a single paragraph with plain text, use body instead
    if (node.children.length === 1 && node.children[0].type === "Paragraph") {
      const para = node.children[0] as OxaBlock & { children: OxaInline[] };
      if (para.children.length === 1 && para.children[0].type === "Text") {
        result.body = (para.children[0] as OxaText).value;
        return result;
      }
    }
    // Otherwise, store children as nested blocks
    result.children = invertBlocks(node.children);
    return result;
  }

  // Unknown admonition kind → generic directive
  const result: MystDirective = {
    ...copyMystBlockBase(node),
    type: "directive",
    name: kind,
    argument: node.title ?? "",
    options,
    body: "",
  };
  // Prefer data.body for round-trip fidelity (preserves raw body text)
  if (node.data?.body !== undefined && typeof node.data.body === "string") {
    result.body = node.data.body;
    return result;
  }
  if (node.children.length === 1 && node.children[0].type === "Paragraph") {
    const para = node.children[0] as OxaBlock & { children: OxaInline[] };
    if (para.children.length === 1 && para.children[0].type === "Text") {
      result.body = (para.children[0] as OxaText).value;
      return result;
    }
  }
  result.children = invertBlocks(node.children);
  return result;
}

function extractBodyText(block: OxaBlock): string {
  if (block.type === "Paragraph") {
    const para = block as OxaBlock & { children: OxaInline[] };
    return para.children.map(extractText).join("");
  }
  return "";
}

function invertBlocks(nodes: OxaBlock[]): MystBlock[] {
  const result: MystBlock[] = [];
  for (const node of nodes) {
    const inverted = invertBlock(node);
    if (inverted !== undefined) {
      result.push(inverted);
    }
  }
  return result;
}

function invertBlock(node: OxaBlock): MystBlock | undefined {
  switch (node.type) {
    case "Heading":
      return invertHeading(node as OxaBlock & { level: number; children: OxaInline[] });
    case "Paragraph":
      return invertParagraph(node as OxaBlock & { children: OxaInline[] });
    case "Code":
      return invertCode(node as OxaBlock & { value: string; language?: string; data?: Record<string, unknown> });
    case "ThematicBreak":
      return invertThematicBreak(node);
    case "Blockquote":
      return invertBlockquote(node as OxaBlock & { children: OxaBlock[] });
    case "Image": {
      const img = node as OxaBlock & { src: string; alt?: string; data?: Record<string, unknown> };
      // Figure directive: if data has caption, reconstruct as figure directive
      if (img.data && "caption" in img.data) {
        const result: MystDirective = {
          type: "directive",
          name: "figure",
          argument: img.src,
          options: {},
          body: img.data.caption as string,
        };
        if (img.alt !== undefined) {
          result.options.alt = img.alt;
        }
        // Copy other options from data
        for (const [key, value] of Object.entries(img.data)) {
          if (key !== "caption" && key !== "alt" && key !== "options") {
            result.options[key] = String(value);
          }
        }
        // Also restore structured options if present
        const dataOpts = img.data.options as Record<string, string> | undefined;
        if (dataOpts) {
          Object.assign(result.options, dataOpts);
        }
        return result;
      }
      return invertImage(img);
    }
    case "Math":
      return invertMath(node as OxaBlock & { value: string; data?: Record<string, unknown> });
    case "List":
      return invertList(node as OxaBlock & { ordered: boolean; startIndex?: number; children: OxaListItem[] });
    case "Admonition":
      return invertAdmonition(node as OxaBlock & { kind: string; title?: string; children: OxaBlock[]; data?: Record<string, unknown> });
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Document conversion (OXA → MyST)
// ---------------------------------------------------------------------------

/**
 * Convert an OXA tree-model document back to a MyST document.
 *
 * This is the inverse of `convertMystToOxa`. Because the lens includes
 * a retraction (role → InlineCode), the round-trip is not perfect:
 * InlineCode nodes without `language: "latex"` lose their role origin.
 *
 * @param doc - OXA tree-model document.
 * @returns MyST document AST.
 */
export function convertOxaToMyst(doc: OxaDocument): MystDocument {
  const children = invertBlocks(doc.children);

  const result: MystDocument = {
    type: "document",
    children,
  };

  // Inverse of title conversion: OxaInline[] → string
  if (doc.title !== undefined && doc.title.length > 0) {
    result.title = doc.title.map(extractText).join("");
  }

  // Inverse of metadata: pass through
  if (doc.metadata !== undefined) {
    result.metadata = doc.metadata;
  }

  return result;
}
