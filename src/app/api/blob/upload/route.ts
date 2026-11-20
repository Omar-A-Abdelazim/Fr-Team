import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { connection } from "next/server";
import { callerFromToken, isFail, json } from "@/lib/server/auth";

// Newer Vercel Blob stores connect with BLOB_STORE_ID (+ Vercel OIDC); older ones with a read-write token.
const blobEnabled = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

// Issues short-lived upload tokens so the browser can upload proposals straight to Vercel Blob
// (bypassing the ~4.5 MB request limit of server functions). Only approved members may upload.

const MAX = 20 * 1024 * 1024; // Gmail allows 25 MB per email in total

export async function GET() {
  await connection(); // read env at request time, not at build time
  return json({ enabled: blobEnabled(), maxBytes: MAX });
}

export async function POST(req: Request) {
  if (!blobEnabled()) return json({ error: "File storage isn't set up yet." }, 503);
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const me = await callerFromToken(clientPayload ?? "");
        if (isFail(me)) throw new Error(me.error);
        return {
          maximumSizeInBytes: MAX,
          addRandomSuffix: true,
          allowedContentTypes: [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
            "image/png",
            "image/jpeg",
          ],
        };
      },
    });
    return json(result);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}
