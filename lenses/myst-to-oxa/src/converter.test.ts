import { describe, it, expect } from "vitest";
import { convertMystToOxa } from "./converter.js";
import type { MystDocument, MystBlock, MystInline } from "./types.js";

describe("convertMystToOxa", () => {
  it("converts a heading", () => {
    const doc: MystDocument = {
      type: "document",
      children: [
        {
          type: "heading",
          level: 1,
          children: [{ type: "text", value: "Introduction" }],
        },
      ],
    };

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
      type: "Document",
      children: [
        {
          type: "Heading",
          level: 1,
          children: [{ type: "Text", value: "Introduction" }],
        },
      ],
    });
  });

  it("converts a paragraph", () => {
    const doc: MystDocument = {
      type: "document",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "Hello world." }],
        },
      ],
    };

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
      type: "Document",
      children: [
        {
          type: "Paragraph",
          children: [{ type: "Text", value: "Hello world." }],
        },
      ],
    });
  });

  it("converts a code block", () => {
    const doc: MystDocument = {
      type: "document",
      children: [
        {
          type: "code_block",
          value: "const x = 1;",
          language: "javascript",
        },
      ],
    };

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
      type: "Document",
      children: [
        {
          type: "Code",
          value: "const x = 1;",
          language: "javascript",
        },
      ],
    });
  });

  it("converts a code block without language", () => {
    const doc: MystDocument = {
      type: "document",
      children: [
        {
          type: "code_block",
          value: "plain text code",
        },
      ],
    };

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
      type: "Document",
      children: [
        {
          type: "Code",
          value: "plain text code",
        },
      ],
    });
  });

  it("converts a thematic break", () => {
    const doc: MystDocument = {
      type: "document",
      children: [{ type: "thematic_break" }],
    };

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
      type: "Document",
      children: [{ type: "ThematicBreak" }],
    });
  });

  it("converts inline formatting", () => {
    const doc: MystDocument = {
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
    };

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
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
    });
  });

  it("converts inline code", () => {
    const doc: MystDocument = {
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
    };

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
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
    });
  });

  it("converts MyST roles", () => {
    const doc: MystDocument = {
      type: "document",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "role", name: "code", content: "x + y" },
            { type: "text", value: " and " },
            { type: "role", name: "sup", content: "2" },
            { type: "text", value: " and " },
            { type: "role", name: "sub", content: "n" },
          ],
        },
      ],
    };

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
      type: "Document",
      children: [
        {
          type: "Paragraph",
          children: [
            { type: "InlineCode", value: "x + y" },
            { type: "Text", value: " and " },
            { type: "Superscript", children: [{ type: "Text", value: "2" }] },
            { type: "Text", value: " and " },
            { type: "Subscript", children: [{ type: "Text", value: "n" }] },
          ],
        },
      ],
    });
  });

  it("converts code-block directive", () => {
    const doc: MystDocument = {
      type: "document",
      children: [
        {
          type: "directive",
          name: "code-block",
          argument: "python",
          options: {},
          body: "print('hello')",
        },
      ],
    };

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
      type: "Document",
      children: [
        {
          type: "Code",
          value: "print('hello')",
          language: "python",
        },
      ],
    });
  });

  it("converts blockquotes, images, math blocks, and lists", () => {
    const doc: MystDocument = {
      type: "document",
      children: [
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

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
      type: "Document",
      children: [
        {
          type: "Blockquote",
          children: [{ type: "Paragraph", children: [{ type: "Text", value: "quoted" }] }],
        },
        { type: "Image", src: "https://example.com/img.png", alt: "alt text" },
        { type: "Math", value: "E = mc^2" },
        {
          type: "List",
          ordered: true,
          children: [
            { type: "ListItem", children: [{ type: "Paragraph", children: [{ type: "Text", value: "first" }] }] },
          ],
        },
        {
          type: "List",
          ordered: false,
          children: [
            { type: "ListItem", children: [{ type: "Paragraph", children: [{ type: "Text", value: "bullet" }] }] },
          ],
        },
      ],
    });
  });

  it("converts math directive to Math block", () => {
    const doc: MystDocument = {
      type: "document",
      children: [
        {
          type: "directive",
          name: "math",
          argument: "",
          options: {},
          body: "E = mc^2",
        },
      ],
    };

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
      type: "Document",
      children: [
        { type: "Math", value: "E = mc^2" },
      ],
    });
  });

  it("converts admonition directives", () => {
    const doc: MystDocument = {
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
    };

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
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
    });
  });

  it("converts figure directive to Image", () => {
    const doc: MystDocument = {
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
    };

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
      type: "Document",
      children: [
        {
          type: "Image",
          src: "photo.png",
          alt: "A photo",
          data: { caption: "Caption text.", alt: "A photo", width: "50%" },
        },
      ],
    });
  });

  it("converts {math} role to InlineCode with latex language", () => {
    const doc: MystDocument = {
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
    };

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
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
    });
  });

  it("drops truly unknown directives without body", () => {
    const doc: MystDocument = {
      type: "document",
      children: [
        {
          type: "directive",
          name: "custom-thing",
          argument: "",
          options: {},
          body: "",
        },
      ],
    };

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
      type: "Document",
      children: [],
    });
  });

  it("converts document with title", () => {
    const doc: MystDocument = {
      type: "document",
      title: "My Document",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "Content." }],
        },
      ],
    };

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
      type: "Document",
      title: [{ type: "Text", value: "My Document" }],
      children: [
        {
          type: "Paragraph",
          children: [{ type: "Text", value: "Content." }],
        },
      ],
    });
  });

  it("converts a full document with mixed blocks", () => {
    const doc: MystDocument = {
      type: "document",
      title: "Test Document",
      children: [
        {
          type: "heading",
          level: 1,
          children: [{ type: "text", value: "Title" }],
        },
        {
          type: "paragraph",
          children: [
            { type: "text", value: "A paragraph with " },
            { type: "strong", children: [{ type: "text", value: "bold" }] },
            { type: "text", value: " text." },
          ],
        },
        {
          type: "code_block",
          value: "console.log('hi');",
          language: "javascript",
        },
        { type: "thematic_break" },
        {
          type: "paragraph",
          children: [{ type: "text", value: "After the break." }],
        },
      ],
    };

    const result = convertMystToOxa(doc);

    expect(result).toEqual({
      type: "Document",
      title: [{ type: "Text", value: "Test Document" }],
      children: [
        {
          type: "Heading",
          level: 1,
          children: [{ type: "Text", value: "Title" }],
        },
        {
          type: "Paragraph",
          children: [
            { type: "Text", value: "A paragraph with " },
            { type: "Strong", children: [{ type: "Text", value: "bold" }] },
            { type: "Text", value: " text." },
          ],
        },
        {
          type: "Code",
          value: "console.log('hi');",
          language: "javascript",
        },
        { type: "ThematicBreak" },
        {
          type: "Paragraph",
          children: [{ type: "Text", value: "After the break." }],
        },
      ],
    });
  });
});
