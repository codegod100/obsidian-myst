/**
 * Publish a markdown note as an OXA-ATProto record to a PDS.
 *
 * Pipeline: markdown → MyST AST → OXA tree → ATProto flat record → PDS write
 */

import { parseMyst } from "./myst-parser";
import { convertMystToOxa } from "../../lenses/myst-to-oxa/src/converter";
import { oxaToAtproto, type AtprotoDocument } from "./oxa-atproto";
import type { Client } from "@atcute/client";

export interface PublishResult {
	uri: string;
	cid: string;
}

/**
 * Convert raw markdown to an ATProto OXA document record.
 *
 * @param markdown - Raw markdown source.
 * @returns ATProto flat record.
 */
export function markdownToAtprotoRecord(markdown: string): AtprotoDocument {
	const mystDoc = parseMyst(markdown);
	const oxaDoc = convertMystToOxa(mystDoc);
	return oxaToAtproto(oxaDoc);
}

/**
 * Publish a markdown note as an OXA document to a PDS.
 *
 * @param markdown - Raw markdown source.
 * @param client - Authenticated ATProto client.
 * @param did - The publisher's DID.
 * @returns The URI and CID of the created record.
 */
export async function publishNoteToPds(
	markdown: string,
	client: Client,
	did: string,
): Promise<PublishResult> {
	const record = markdownToAtprotoRecord(markdown);

	const rkey = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

	const result = await (client as any).post("com.atproto.repo.putRecord", {
		input: {
			repo: did,
			collection: "pub.oxa.document",
			rkey,
			record,
			validate: false,
		},
	});

	return {
		uri: (result as any).uri,
		cid: (result as any).cid,
	};
}
