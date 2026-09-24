import { CopilotClient, type CopilotSession } from "@github/copilot-sdk";
import { createShopSession, KICKOFF, viewCart, type CouponResult } from "./agent";
import index from "./index.html";

const client = new CopilotClient();
// ponytail: one global session, fine for a local single-user demo; key sessions by cookie if ever hosted
let session: CopilotSession | undefined;
let applied: { code: string; result: CouponResult } | undefined;

async function send(prompt: string) {
  if (!session) throw new Error("No session, call /api/start first");
  const replies: string[] = [];
  const off = session.on("assistant.message", (event) => {
    if (event.data.content) replies.push(event.data.content);
  });
  try {
    await session.sendAndWait({ prompt });
  } finally {
    off();
  }
  return { replies, applied };
}

function serve(port: number): ReturnType<typeof Bun.serve> {
  try {
    return Bun.serve({
      port,
      routes: {
        "/": index,
        "/api/start": {
          POST: async () => {
            await session?.disconnect();
            applied = undefined;
            session = await createShopSession(client, (code, result) => {
              if (result.valid) applied = { code: code.trim().toUpperCase(), result };
            });
            return Response.json({ cart: viewCart(), ...(await send(KICKOFF)) });
          },
        },
        "/api/chat": {
          POST: async (req) => {
            const { message } = (await req.json()) as { message?: string };
            if (!message?.trim()) return Response.json({ error: "empty message" }, { status: 400 });
            return Response.json(await send(message.trim()));
          },
        },
      },
      error: (err) => Response.json({ error: err.message }, { status: 500 }),
    });
  } catch (err) {
    if ((err as { code?: string }).code === "EADDRINUSE") return serve(port + 1);
    throw err;
  }
}

const server = serve(Number(process.env.PORT ?? 3000));
console.log(`GitHub Shop checkout UI on ${server.url}`);
