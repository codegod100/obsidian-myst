/**
 * Publish the comprehensive MyST fixture as a pub.oxa.document record.
 *
 * Pipeline: markdown → parseMyst → convertMystToOxa → oxaToAtproto → PDS write
 *
 * Usage:
 *   PDS_URL=https://amanita.us-east.host.bsky.network \
 *   DID=did:plc:ngokl2gnmpbvuvrfckja3g7p \
 *   APP_PASSWORD="$ATPROTO_APP_PASSWORD" \
 *   HANDLE=nandi.latha.org \
 *   npx tsx scripts/publish-fixture.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { parseMyst } from "../src/export/myst-parser";
import { convertMystToOxa } from "../lenses/myst-to-oxa/src/converter";
import { oxaToAtproto } from "../src/export/oxa-atproto";

const PDS_URL = process.env.PDS_URL || "";
const DID = process.env.DID || "";
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const HANDLE = process.env.HANDLE || "";
const RKEY = process.env.RKEY || "comprehensive-fixture";

async function getAccessToken(): Promise<string> {
  if (!APP_PASSWORD || !HANDLE || !PDS_URL) {
    throw new Error("Need APP_PASSWORD, HANDLE, and PDS_URL");
  }

  const res = await fetch(`${PDS_URL}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: HANDLE, password: APP_PASSWORD }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create session: ${err}`);
  }

  const data = await res.json() as any;
  return data.accessJwt;
}

async function putRecord(rkey: string, record: any, token: string): Promise<string> {
  const body = {
    repo: DID,
    collection: "pub.oxa.document",
    rkey,
    record,
    validate: false,
  };

  const res = await fetch(`${PDS_URL}/xrpc/com.atproto.repo.putRecord`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`putRecord failed for ${rkey}: ${err}`);
  }

  const data = await res.json() as any;
  return data.uri;
}

async function main() {
  if (!PDS_URL || !DID) {
    console.error("Usage: PDS_URL=<url> DID=<did> APP_PASSWORD=<pw> HANDLE=<handle> npx tsx scripts/publish-fixture.ts");
    process.exit(1);
  }

  // Read the comprehensive fixture
  const fixturePath = join(__dirname, "../tests/fixtures/myst-comprehensive.md");
  const markdown = readFileSync(fixturePath, "utf8");

  // Full pipeline: markdown → MyST → OXA → ATProto
  const myst = parseMyst(markdown);
  const oxa = convertMystToOxa(myst);
  const record = oxaToAtproto(oxa);

  console.log(`Parsed ${myst.children.length} blocks from fixture`);
  console.log(`OXA document has ${oxa.children.length} children`);
  console.log(`ATProto record has ${record.children.length} blocks`);

  // Write to PDS
  const token = await getAccessToken();
  const uri = await putRecord(RKEY, record, token);

  console.log(`\nPublished: ${uri}`);
  console.log(`View at: https://research.latha.org/`);
}

main().catch(console.error);
