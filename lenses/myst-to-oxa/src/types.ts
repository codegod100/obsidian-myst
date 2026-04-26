/**
 * MyST and OXA type definitions for the myst-to-oxa converter.
 */

// ---------------------------------------------------------------------------
// MyST types (source)
// ---------------------------------------------------------------------------

export interface MystText {
  type: "text";
  value: string;
}

export interface MystHeading {
  type: "heading";
  level: number;
  children: MystInline[];
}

export interface MystParagraph {
  type: "paragraph";
  children: MystInline[];
}

export interface MystCodeBlock {
  type: "code_block";
  value: string;
  language?: string;
}

export interface MystThematicBreak {
  type: "thematic_break";
}

export interface MystBlockquote {
  type: "blockquote";
  children: MystBlock[];
}

export interface MystImage {
  type: "image";
  src: string;
  alt?: string;
}

export interface MystMathBlock {
  type: "math_block";
  value: string;
}

export interface MystOrderedList {
  type: "ordered_list";
  children: MystListItem[];
  startIndex?: number;
}

export interface MystUnorderedList {
  type: "unordered_list";
  children: MystListItem[];
}

export interface MystListItem {
  type: "list_item";
  children: MystBlock[];
}

export interface MystDirective {
  type: "directive";
  name: string;
  argument: string;
  options: Record<string, string>;
  body: string;
  children?: MystBlock[];
}

export interface MystRole {
  type: "role";
  name: string;
  content: string;
}

export type MystInline = MystText | MystStrong | MystEmphasis | MystInlineCode | MystRole | MystLink;

export interface MystStrong {
  type: "strong";
  children: MystInline[];
}

export interface MystEmphasis {
  type: "emphasis";
  children: MystInline[];
}

export interface MystInlineCode {
  type: "inline_code";
  value: string;
}

export interface MystLink {
  type: "link";
  target: string;
  children?: MystInline[];
}

export type MystBlock =
  | MystHeading
  | MystParagraph
  | MystCodeBlock
  | MystThematicBreak
  | MystBlockquote
  | MystImage
  | MystMathBlock
  | MystOrderedList
  | MystUnorderedList
  | MystDirective;

export interface MystDocument {
  type: "document";
  children: MystBlock[];
  title?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// OXA tree-model types (target)
// ---------------------------------------------------------------------------

export interface OxaText {
  type: "Text";
  value: string;
}

export interface OxaStrong {
  type: "Strong";
  children: OxaInline[];
}

export interface OxaEmphasis {
  type: "Emphasis";
  children: OxaInline[];
}

export interface OxaInlineCode {
  type: "InlineCode";
  value: string;
  language?: string;
}

export interface OxaLink {
  type: "Link";
  target: string;
  children?: OxaInline[];
}

export interface OxaSuperscript {
  type: "Superscript";
  children: OxaInline[];
}

export interface OxaSubscript {
  type: "Subscript";
  children: OxaInline[];
}

export type OxaInline =
  | OxaText
  | OxaStrong
  | OxaEmphasis
  | OxaInlineCode
  | OxaLink
  | OxaSuperscript
  | OxaSubscript;

export interface OxaBlockBase {
  id?: string;
  classes?: string[];
  data?: Record<string, unknown>;
}

export interface OxaParagraph extends OxaBlockBase {
  type: "Paragraph";
  children: OxaInline[];
}

export interface OxaHeading extends OxaBlockBase {
  type: "Heading";
  level: number;
  children: OxaInline[];
}

export interface OxaCode extends OxaBlockBase {
  type: "Code";
  value: string;
  language?: string;
}

export interface OxaThematicBreak extends OxaBlockBase {
  type: "ThematicBreak";
}

export interface OxaBlockquote extends OxaBlockBase {
  type: "Blockquote";
  children: OxaBlock[];
}

export interface OxaImage extends OxaBlockBase {
  type: "Image";
  src: string;
  alt?: string;
}

export interface OxaMath extends OxaBlockBase {
  type: "Math";
  value: string;
}

export interface OxaList extends OxaBlockBase {
  type: "List";
  ordered: boolean;
  startIndex?: number;
  children: OxaListItem[];
}

export interface OxaListItem extends OxaBlockBase {
  type: "ListItem";
  children: OxaBlock[];
}

export interface OxaAdmonition extends OxaBlockBase {
  type: "Admonition";
  kind: string;
  title?: string;
  children: OxaBlock[];
}

export type OxaBlock =
  | OxaParagraph
  | OxaHeading
  | OxaCode
  | OxaThematicBreak
  | OxaBlockquote
  | OxaImage
  | OxaMath
  | OxaList
  | OxaAdmonition;

export interface OxaDocument {
  type: "Document";
  children: OxaBlock[];
  title?: OxaInline[];
  metadata?: Record<string, unknown>;
}
