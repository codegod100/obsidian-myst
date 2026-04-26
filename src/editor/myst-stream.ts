import { StreamLanguage } from "@codemirror/language";
import type { StringStream } from "@codemirror/language";

/**
 * StreamLanguage parser for MyST surface syntax.
 *
 * Recognizes:
 * - Role syntax: {name}`content`
 * - Directive fence: :::{name} ... :::
 * - Directive options: :key: value
 * - Dollar math: $...$ and $$...$$
 * - Citations: {cite}:key
 *
 * This is a surface-syntax parser — it doesn't build a full AST.
 * It provides token classes for syntax highlighting and decoration anchors.
 */

interface ParserState {
	inDirective: boolean;
	inDirectiveOptions: boolean;
	directiveFenceLen: number;
	inDollarMath: boolean;
	inDisplayMath: boolean;
}

export function mystStreamLanguage() {
	return StreamLanguage.define({
		name: "myst",

		startState(): ParserState {
			return {
				inDirective: false,
				inDirectiveOptions: false,
				directiveFenceLen: 0,
				inDollarMath: false,
				inDisplayMath: false,
			};
		},

		token(stream: StringStream, state: ParserState): string | null {
			// Inside a directive block
			if (state.inDirective) {
				return directiveToken(stream, state);
			}

			// Inside dollar math
			if (state.inDollarMath || state.inDisplayMath) {
				return mathToken(stream, state);
			}

			// Whitespace
			if (stream.eatSpace()) return null;

			// Directive fence: :::{name} or ::: at end
			if (stream.match(/^:::+\s*\{/, false)) {
				return directiveOpenToken(stream, state);
			}

			// Closing directive fence: :::
			if (stream.match(/^:::+\s*$/)) {
				return "mystDirectiveFence";
			}

			// Role syntax: {name}`content`
			if (stream.match(/^\{[a-zA-Z][a-zA-Z0-9_:.-]*\}`/, false)) {
				return roleToken(stream);
			}

			// Display math: $$...$$
			if (stream.match(/^\$\$/)) {
				state.inDisplayMath = true;
				return "mystDollarMath";
			}

			// Inline math: $...$
			if (stream.match(/^\$(?!\$)/)) {
				state.inDollarMath = true;
				return "mystDollarMath";
			}

			// Nothing matched — advance one character
			stream.next();
			return null;
		},

		blankLine(state: ParserState) {
			if (state.inDirective && state.inDirectiveOptions) {
				state.inDirectiveOptions = false;
			}
		},

		indent() {
			return 0;
		},
	});
}

function directiveOpenToken(stream: StringStream, state: ParserState): string | null {
	// Eat the :::
	if (!stream.match(/^:::+/)) return null;
	state.inDirective = true;
	state.inDirectiveOptions = true;

	// Eat whitespace
	stream.eatSpace();

	// Eat {name}
	if (stream.match(/^\{[a-zA-Z][a-zA-Z0-9_:.-]*\}/)) {
		// The name is inside braces
	}

	// Eat the rest of the line (argument text)
	stream.eatWhile(/[^\n]/);

	return "mystDirectiveFence";
}

function directiveToken(stream: StringStream, state: ParserState): string | null {
	// Check for closing fence
	if (stream.match(/^:::+\s*$/)) {
		state.inDirective = false;
		state.inDirectiveOptions = false;
		return "mystDirectiveFence";
	}

	// Directive options: :key: value
	if (state.inDirectiveOptions && stream.match(/^:[a-zA-Z][a-zA-Z0-9_-]*:\s*/)) {
		// Eat the value
		stream.eatWhile(/[^\n]/);
		return "mystDirectiveOption";
	}

	// Blank line ends options section
	if (stream.eatSpace()) {
		return null;
	}

	// Regular content inside directive
	stream.eatWhile(/[^\n]/);
	return "mystDirectiveBody";
}

function roleToken(stream: StringStream): string | null {
	// {name}
	if (!stream.match(/^\{/)) return null;
	stream.eatWhile(/[a-zA-Z0-9_:.-]/);
	if (!stream.match(/^\}/)) {
		// Not a valid role — bail
		stream.next();
		return null;
	}

	// Backtick content
	if (stream.match(/^`/)) {
		stream.eatWhile(/[^`]/);
		stream.match(/^`/);
	}

	return "mystRole";
}

function mathToken(stream: StringStream, state: ParserState): string | null {
	// Display math close: $$
	if (state.inDisplayMath && stream.match(/^\$\$/)) {
		state.inDisplayMath = false;
		return "mystDollarMath";
	}

	// Inline math close: $ (not $$)
	if (state.inDollarMath && !state.inDisplayMath && stream.match(/^\$(?!\$)/)) {
		state.inDollarMath = false;
		return "mystDollarMath";
	}

	// Math content
	if (stream.eatWhile(/[^$\n]/)) {
		return "mystMathContent";
	}

	// End of line inside math
	stream.next();
	return "mystMathContent";
}
