import { describe, it, expect } from "vitest";
import { convertOxaToMyst } from "./inverse.js";
import { convertMystToOxa } from "./converter.js";
import type { OxaDocument, OxaBlock, OxaInline } from "./types.js";
import type { MystDocument } from "./types.js";

describe("convertOxaToMyst", () => {
  it("converts a heading", () => {
    const doc: OxaDocument = {
      type: "Document",
      children: [
        {
          type: "Heading",
          level: 1,
          children: [{ type: "Text", value: "Introduction" }],
        },
      ],
    };

    const result = convertOxaToMyst(doc);

    expect(result).toEqual({
      type: "document",
      children: [
        {
          type: "heading",
          level: 1,
          children: [{ type: "text", value: "Introduction" }],
        },
      ],
    });
  });

  it("converts a paragraph", () => {
    const doc: OxaDocument = {
      type: "Document",
      children: [
        {
          type: "Paragraph",
          children: [{ type: "Text", value: "Hello world." }],
        },
      ],
    };

    const result = convertOxaToMyst(doc);

    expect(result).toEqual({
      type: "document",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "Hello world." }],
        },
      ],
    });
  });

  it("converts a code block", () => {
    const doc: OxaDocument = {
      type: "Document",
      children: [
        {
          type: "Code",
          value: "const x = 1;",
          language: "javascript",
        },
      ],
    };

    const result = convertOxaToMyst(doc);

    expect(result).toEqual({
      type: "document",
      children: [
        {
          type: "code_block",
          value: "const x = 1;",
          language: "javascript",
        },
      ],
    });
  });

  it("converts a thematic break", () => {
    const doc: OxaDocument = {
      type: "Document",
      children: [{ type: "ThematicBreak" }],
    };

    const result = convertOxaToMyst(doc);

    expect(result).toEqual({
      type: "document",
      children: [{ type: "thematic_break" }],
    });
  });

  it("converts inline formatting", () => {
    const doc: OxaDocument = {
      type: "Document",
      children: [
        {
          type: "Paragraph",
          children: [
            { type: "Text", value: "Some " },
            {
              type: "Strong",
              children: [
                { type: "Text", value: "bold" },
                { type: "Emphasis", children: [{ type: "Text", value: " and italic" }] },
              ],
            },
            { type: "Text", value: " text." },
          ],
        },
      ],
    };

    const result = convertOxaToMyst(doc);

    expect(result).toEqual({
      type: "document",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "Some " },
            {
              type: "strong",
              children: [
                { type: "text", value: "bold" },
                { type: "emphasis", children: [{ type: "text", value: " and italic" }] },
              ],
            },
            { type: "text", value: " text." },
          ],
        },
      ],
    });
  });

  it("converts InlineCode back to inline_code", () => {
    const doc: OxaDocument = {
      type: "Document",
      children: [
        {
          type: "Paragraph",
          children: [
            { type: "Text", value: "Use " },
            { type: "InlineCode", value: "console.log" },
            { type: "Text", value: " to debug." },
          ],
        },
      ],
    };

    const result = convertOxaToMyst(doc);

    expect(result).toEqual({
      type: "document",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "Use " },
            { type: "inline_code", value: "console.log" },
            { type: "text", value: " to debug." },
          ],
        },
      ],
    });
  });

  it("reconstructs {math} role from InlineCode with latex language", () => {
    const doc: OxaDocument = {
      type: "Document",
      children: [
        {
          type: "Paragraph",
          children: [
            { type: "Text", value: "Equation: " },
            { type: "InlineCode", value: "a^2 + b^2", language: "latex" },
          ],
        },
      ],
    };

    const result = convertOxaToMyst(doc);

    expect(result).toEqual({
      type: "document",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "Equation: " },
            { type: "role", name: "math", content: "a^2 + b^2" },
          ],
        },
      ],
    });
  });

  it("reconstructs {sup} and {sub} roles from Superscript/Subscript", () => {
    const doc: OxaDocument = {
      type: "Document",
      children: [
        {
          type: "Paragraph",
          children: [
            { type: "Superscript", children: [{ type: "Text", value: "2" }] },
            { type: "Text", value: " and " },
            { type: "Subscript", children: [{ type: "Text", value: "n" }] },
          ],
        },
      ],
    };

    const result = convertOxaToMyst(doc);

    expect(result).toEqual({
      type: "document",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "role", name: "sup", content: "2" },
            { type: "text", value: " and " },
            { type: "role", name: "sub", content: "n" },
          ],
        },
      ],
    });
  });

  it("splits List with ordered=true into ordered_list", () => {
    const doc: OxaDocument = {
      type: "Document",
      children: [
        {
          type: "List",
          ordered: true,
          children: [
            { type: "ListItem", children: [{ type: "Paragraph", children: [{ type: "Text", value: "first" }] }] },
          ],
        },
      ],
    };

    const result = convertOxaToMyst(doc);

    expect(result).toEqual({
      type: "document",
      children: [
        {
          type: "ordered_list",
          children: [
            { type: "list_item", children: [{ type: "paragraph", children: [{ type: "text", value: "first" }] }] },
          ],
        },
      ],
    });
  });

  it("splits List with ordered=false into unordered_list", () => {
    const doc: OxaDocument = {
      type: "Document",
      children: [
        {
          type: "List",
          ordered: false,
          children: [
            { type: "ListItem", children: [{ type: "Paragraph", children: [{ type: "Text", value: "bullet" }] }] },
          ],
        },
      ],
    };

    const result = convertOxaToMyst(doc);

    expect(result).toEqual({
      type: "document",
      children: [
        {
          type: "unordered_list",
          children: [
            { type: "list_item", children: [{ type: "paragraph", children: [{ type: "text", value: "bullet" }] }] },
          ],
        },
      ],
    });
  });

  it("converts Admonition back to directive", () => {
    const doc: OxaDocument = {
      type: "Document",
      children: [
        {
          type: "Admonition",
          kind: "note",
          children: [
            { type: "Paragraph", children: [{ type: "Text", value: "Some info." }] },
          ],
        },
        {
          type: "Admonition",
          kind: "warning",
          title: "Watch out",
          children: [
            { type: "Paragraph", children: [{ type: "Text", value: "Be careful." }] },
          ],
        },
      ],
    };

    const result = convertOxaToMyst(doc);

    expect(result).toEqual({
      type: "document",
      children: [
        {
          type: "directive",
          name: "note",
          argument: "",
          options: {},
          body: "Some info.",
        },
        {
          type: "directive",
          name: "warning",
          argument: "Watch out",
          options: {},
          body: "Be careful.",
        },
      ],
    });
  });

  it("converts Image with caption data back to figure directive", () => {
    const doc: OxaDocument = {
      type: "Document",
      children: [
        {
          type: "Image",
          src: "photo.png",
          alt: "A photo",
          data: { caption: "Caption text.", alt: "A photo", width: "50%" },
        },
      ],
    };

    const result = convertOxaToMyst(doc);

    expect(result).toEqual({
      type: "document",
      children: [
        {
          type: "directive",
          name: "figure",
          argument: "photo.png",
          options: { alt: "A photo", width: "50%" },
          body: "Caption text.",
        },
      ],
    });
  });

  it("converts document with title", () => {
    const doc: OxaDocument = {
      type: "Document",
      title: [{ type: "Text", value: "My Document" }],
      children: [
        {
          type: "Paragraph",
          children: [{ type: "Text", value: "Content." }],
        },
      ],
    };

    const result = convertOxaToMyst(doc);

    expect(result).toEqual({
      type: "document",
      title: "My Document",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "Content." }],
        },
      ],
    });
  });
});

describe("round-trip: MyST → OXA → MyST", () => {
  it("preserves headings", () => {
    const original: MystDocument = {
      type: "document",
      children: [
        { type: "heading", level: 2, children: [{ type: "text", value: "Section" }] },
      ],
    };

    const oxa = convertMystToOxa(original);
    const result = convertOxaToMyst(oxa);

    expect(result).toEqual(original);
  });

  it("preserves paragraphs with inline formatting", () => {
    const original: MystDocument = {
      type: "document",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "Some " },
            { type: "strong", children: [{ type: "text", value: "bold" }] },
            { type: "text", value: " text." },
          ],
        },
      ],
    };

    const oxa = convertMystToOxa(original);
    const result = convertOxaToMyst(oxa);

    expect(result).toEqual(original);
  });

  it("preserves code blocks", () => {
    const original: MystDocument = {
      type: "document",
      children: [
        { type: "code_block", value: "x = 1", language: "python" },
      ],
    };

    const oxa = convertMystToOxa(original);
    const result = convertOxaToMyst(oxa);

    expect(result).toEqual(original);
  });

  it("preserves lists", () => {
    const original: MystDocument = {
      type: "document",
      children: [
        {
          type: "ordered_list",
          children: [
            { type: "list_item", children: [{ type: "paragraph", children: [{ type: "text", value: "first" }] }] },
          ],
        },
        {
          type: "unordered_list",
          children: [
            { type: "list_item", children: [{ type: "paragraph", children: [{ type: "text", value: "bullet" }] }] },
          ],
        },
      ],
    };

    const oxa = convertMystToOxa(original);
    const result = convertOxaToMyst(oxa);

    expect(result).toEqual(original);
  });

  it("preserves {math} roles (retraction round-trip)", () => {
    const original: MystDocument = {
      type: "document",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "role", name: "math", content: "E = mc^2" },
          ],
        },
      ],
    };

    const oxa = convertMystToOxa(original);
    const result = convertOxaToMyst(oxa);

    expect(result).toEqual(original);
  });

  it("preserves admonition directives", () => {
    const original: MystDocument = {
      type: "document",
      children: [
        {
          type: "directive",
          name: "note",
          argument: "",
          options: {},
          body: "Some info.",
        },
      ],
    };

    const oxa = convertMystToOxa(original);
    const result = convertOxaToMyst(oxa);

    expect(result).toEqual(original);
  });

  it("preserves document with title", () => {
    const original: MystDocument = {
      type: "document",
      title: "Test Document",
      children: [
        { type: "paragraph", children: [{ type: "text", value: "Content." }] },
      ],
    };

    const oxa = convertMystToOxa(original);
    const result = convertOxaToMyst(oxa);

    expect(result).toEqual(original);
  });

  it("preserves a full mixed document", () => {
    const original: MystDocument = {
      type: "document",
      title: "Full Test",
      children: [
        { type: "heading", level: 1, children: [{ type: "text", value: "Title" }] },
        {
          type: "paragraph",
          children: [
            { type: "text", value: "A paragraph with " },
            { type: "strong", children: [{ type: "text", value: "bold" }] },
            { type: "text", value: " text." },
          ],
        },
        { type: "code_block", value: "console.log('hi');", language: "javascript" },
        { type: "thematic_break" },
        { type: "paragraph", children: [{ type: "text", value: "After the break." }] },
        {
          type: "blockquote",
          children: [{ type: "paragraph", children: [{ type: "text", value: "quoted" }] }],
        },
        { type: "image", src: "https://example.com/img.png", alt: "alt text" },
        { type: "math_block", value: "E = mc^2" },
        {
          type: "ordered_list",
          children: [
            { type: "list_item", children: [{ type: "paragraph", children: [{ type: "text", value: "first" }] }] },
          ],
        },
        {
          type: "unordered_list",
          children: [
            { type: "list_item", children: [{ type: "paragraph", children: [{ type: "text", value: "bullet" }] }] },
          ],
        },
      ],
    };

    const oxa = convertMystToOxa(original);
    const result = convertOxaToMyst(oxa);

    expect(result).toEqual(original);
  });

  it("loses {code} role origin (retraction)", () => {
    // {code} roles become InlineCode without language, so the round-trip
    // loses the role origin — they come back as inline_code, not {code}
    const original: MystDocument = {
      type: "document",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "role", name: "code", content: "x + y" },
          ],
        },
      ],
    };

    const oxa = convertMystToOxa(original);
    const result = convertOxaToMyst(oxa);

    // The round-trip loses the role origin
    expect(result).toEqual({
      type: "document",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "inline_code", value: "x + y" },
          ],
        },
      ],
    });
  });

  it("loses {sup}/{sub} role origin (retraction)", () => {
    // {sup}/{sub} roles become Superscript/Subscript, which round-trip
    // back to {sup}/{sub} roles — this one actually preserves
    const original: MystDocument = {
      type: "document",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "role", name: "sup", content: "2" },
            { type: "role", name: "sub", content: "n" },
          ],
        },
      ],
    };

    const oxa = convertMystToOxa(original);
    const result = convertOxaToMyst(oxa);

    expect(result).toEqual(original);
  });

  it("preserves directive options (code-block with caption)", () => {
    const original: MystDocument = {
      type: "document",
      children: [
        {
          type: "directive",
          name: "code-block",
          argument: "python",
          options: { caption: "hello.py" },
          body: 'print("Hello, world!")',
        },
      ],
    };

    const oxa = convertMystToOxa(original);
    const result = convertOxaToMyst(oxa);

    expect(result).toEqual(original);
  });

  it("preserves directive options (math with label)", () => {
    const original: MystDocument = {
      type: "document",
      children: [
        {
          type: "directive",
          name: "math",
          argument: "",
          options: { label: "euler" },
          body: "e^{i\\pi} + 1 = 0",
        },
      ],
    };

    const oxa = convertMystToOxa(original);
    const result = convertOxaToMyst(oxa);

    expect(result).toEqual(original);
  });

  it("preserves directive options (tab-item with sync)", () => {
    const original: MystDocument = {
      type: "document",
      children: [
        {
          type: "directive",
          name: "tab-set",
          argument: "",
          options: {},
          body: "",
          children: [
            {
              type: "directive",
              name: "tab-item",
              argument: "Tab 1",
              options: { sync: "tab1" },
              body: "Tab one",
            },
            {
              type: "directive",
              name: "tab-item",
              argument: "Tab 2",
              options: { sync: "tab2" },
              body: "Tab two",
            },
          ],
        },
      ],
    };

    const oxa = convertMystToOxa(original);
    const result = convertOxaToMyst(oxa);

    expect(result).toEqual(original);
  });

  it("preserves figure directive with options", () => {
    const original: MystDocument = {
      type: "document",
      children: [
        {
          type: "directive",
          name: "figure",
          argument: "image.png",
          options: { alt: "A diagram", width: "80%" },
          body: "Caption text below the figure.",
        },
      ],
    };

    const oxa = convertMystToOxa(original);
    const result = convertOxaToMyst(oxa);

    expect(result).toEqual(original);
  });

  it("preserves the full original document from the real record", () => {
    // This is the MyST AST that would be produced by parsing the original document
    const original: MystDocument = {
      type: "document",
      children: [
        {
          type: "directive",
          name: "note",
          argument: "",
          options: {},
          body: "This is a MyST note admonition.",
        },
        {
          type: "paragraph",
          children: [
            { type: "text", value: "The Pythagorean theorem is " },
            { type: "role", name: "math", content: "a^2 + b^2 = c^2" },
            { type: "text", value: " hello" },
          ],
        },
        {
          type: "paragraph",
          children: [
            { type: "text", value: "Inline math: " },
            { type: "role", name: "math", content: "E = mc^2" },
          ],
        },
        {
          type: "math_block",
          value: "\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}",
        },
        {
          type: "paragraph",
          children: [{ type: "text", value: "test" }],
        },
        {
          type: "blockquote",
          children: [
            {
              type: "paragraph",
              children: [{ type: "text", value: "[!warning] Deprecation Notice\nThis API will be removed in v2." }],
            },
          ],
        },
        {
          type: "directive",
          name: "warning",
          argument: "Deprecation Notice",
          options: {},
          body: "This API will be removed in v2.",
        },
        {
          type: "directive",
          name: "note",
          argument: "",
          options: {},
          body: "A note with useful information.",
        },
        {
          type: "directive",
          name: "warning",
          argument: "Watch out",
          options: {},
          body: "This is a warning with a title.",
        },
        {
          type: "directive",
          name: "danger",
          argument: "",
          options: {},
          body: "This is dangerous.",
        },
        {
          type: "directive",
          name: "figure",
          argument: "image.png",
          options: { alt: "A diagram", width: "80%" },
          body: "Caption text below the figure.",
        },
        {
          type: "directive",
          name: "code-block",
          argument: "python",
          options: { caption: "hello.py" },
          body: 'print("Hello, world!")',
        },
        {
          type: "directive",
          name: "math",
          argument: "",
          options: { label: "euler" },
          body: "e^{i\\pi} + 1 = 0",
        },
        {
          type: "directive",
          name: "tab-set",
          argument: "",
          options: {},
          body: "",
          children: [
            {
              type: "directive",
              name: "tab-item",
              argument: "Tab 1",
              options: { sync: "tab1" },
              body: "Tab one",
            },
            {
              type: "directive",
              name: "tab-item",
              argument: "Tab 2",
              options: { sync: "tab2" },
              body: "Tab two",
            },
          ],
        },
      ],
    };

    const oxa = convertMystToOxa(original);
    const result = convertOxaToMyst(oxa);

    expect(result).toEqual(original);
  });
});
