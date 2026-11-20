import { handleUpload, handleUploadPresigned, type HandleUploadBody } from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";
import { connection } from "next/server";
import { callerFromToken, isFail, json } from "@/lib/server/auth";

// Lets the browser upload proposals straight to Vercel Blob (bypassing the ~4.5 MB request
// limit of server functions). Only approved members may upload.
// Newer stores connect with BLOB_STORE_ID + Vercel OIDC and use presigned URLs;
// older ones have BLOB_READ_WRITE_TOKEN and use client tokens.

const MAX = 20 * 1024 * 1024; // Gmail allows 25 MB per email in total
const TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/png",
  "image/jpeg",
];

const mode = () => (process.env.BLOB_READ_WRITE_TOKEN ? "token" : process.env.BLOB_STORE_ID ? "presigned" : null);

async function authorize(clientPayload: string | null) {
  const me = await callerFromToken(clientPayload ?? "");
  if (isFail(me)) throw new Error(me.error);
}

export async function GET() {
  await connection(); // read env at request time, not at build time
  const m = mode();
  return json({ enabled: !!m, mode: m, maxBytes: MAX });
}

export async function POST(req: Request) {
  const m = mode();
  if (!m) return json({ error: "File storage isn't set up yet." }, 503);
  const body = await req.json();
  try {
    if (m === "token") {
      const result = await handleUpload({
        body: body as HandleUploadBody,
        request: req,
        onBeforeGenerateToken: async (_pathname, clientPayload) => {
          await authorize(clientPayload);
          return { maximumSizeInBytes: MAX, addRandomSuffix: true, allowedContentTypes: TYPES };
        },
      });
      return json(result);
    }
    const result = await handleUploadPresigned({
      body,
      request: req,
      getSignedToken: async (pathname, clientPayload) => {
        await authorize(clientPayload);
        void pathname; // the final name gets a random suffix, so scope the short-lived token to the store
        const token = await issueSignedToken({
          pathname: "*",
          operations: ["put"],
          allowedContentTypes: TYPES,
          maximumSizeInBytes: MAX,
          validUntil: Date.now() + 15 * 60 * 1000,
        });
        return { token, urlOptions: { addRandomSuffix: true, allowedContentTypes: TYPES, maximumSizeInBytes: MAX } };
      },
    });
    return json(result);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}
