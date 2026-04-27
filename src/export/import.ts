/**
 * Import an OXA document from an ATProto PDS and convert it to MyST markdown.
 *
 * Pipeline: AT URI → com.atproto.repo.getRecord → AtprotoDocument
 *   → atprotoToOxa() → OxaDocument
 *   → convertOxaToMyst() → MystDocument
 *   → serializeMystToMarkdown() → markdown string
 */

import { atprotoToOxa, type AtprotoDocument } from "./oxa-atproto";
import { convertOxaToMyst } from "../../lenses/myst-to-oxa/src/inverse";
import { serializeMystToMarkdown } from "./myst-serializer";
import type { Client } from "@atcute/client";

// ---------------------------------------------------------------------------
// AT URI parsing
// ---------------------------------------------------------------------------

export interface AtUri {
	repo: string;
	collection: string;
	rkey: string;
}

/**
 * Parse an AT URI into its components.
 *
 * @param uri - AT URI in the format `at://<repo>/<collection>/<rkey>`
 * @returns Parsed components.
 * @throws Error if the URI is malformed.
 */
export function parseAtUri(uri: string): AtUri {
	const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
	if (!match) {
		throw new Error(
			`Invalid AT URI: ${uri}. Expected format: at://<repo>/<collection>/<rkey>`,
		);
	}
	return {
		repo: match[1],
		collection: match[2],
		rkey: match[3],
	};
}

// ---------------------------------------------------------------------------
// Record fetching
// ---------------------------------------------------------------------------

/**
 * Fetch a `pub.oxa.document` record from a PDS.
 *
 * @param client - Authenticated ATProto client (or unauthenticated for public records).
 * @param atUri - AT URI of the record.
 * @returns The record value as an AtprotoDocument.
 */
export async function fetchOxaRecord(
	client: Client,
	atUri: string,
): Promise<AtprotoDocument> {
	const { repo, collection, rkey } = parseAtUri(atUri);

	const resp = await (client as any).get("com.atproto.repo.getRecord", {
		params: { repo, collection, rkey },
	});

	if (!resp.ok) {
		throw new Error(`Failed to fetch record: ${resp.data.error} — ${resp.data.message}`);
	}

	const data = resp.data as any;
	// The record is in data.value; the wrapper has uri, cid, value
	if (!data.value) {
		throw new Error("Record response missing value field");
	}

	return data.value as AtprotoDocument;
}

// ---------------------------------------------------------------------------
// Full import pipeline
// ---------------------------------------------------------------------------

/**
 * Import an OXA document from ATProto and convert it to MyST markdown.
 *
 * @param client - Authenticated ATProto client.
 * @param atUri - AT URI of the record.
 * @returns MyST-flavored markdown string.
 */
export async function importOxaToMarkdown(
	client: Client,
	atUri: string,
): Promise<string> {
	const record = await fetchOxaRecord(client, atUri);
	const oxaDoc = atprotoToOxa(record);
	const mystDoc = convertOxaToMyst(oxaDoc);
	return serializeMystToMarkdown(mystDoc);
}
