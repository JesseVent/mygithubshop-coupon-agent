import { CopilotClient, type CopilotSession } from "@github/copilot-sdk";
import { createShopSession, KICKOFF, toPrompt, viewCart, type CouponResult } from "./agent";
import index from "./index.html";

const client = new CopilotClient();

// ponytail: USD→AUD rate fetched once per server start; refresh per request if it ever runs for days
async function fetchAudRate(): Promise<{ rate: number; date: string } | null> {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?from=USD&to=AUD");
    const data = (await res.json()) as { date: string; rates: { AUD: number } };
    return { rate: data.rates.AUD, date: data.date };
  } catch {
    return null;
  }
}
const aud = await fetchAudRate();
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
            return Response.json({ cart: viewCart(), aud, ...(await send(KICKOFF)) });
          },
        },
        "/api/chat": {
          POST: async (req) => {
            const { message } = (await req.json()) as { message?: string };
            if (!message?.trim()) return Response.json({ error: "empty message" }, { status: 400 });
            return Response.json(await send(toPrompt(message)));
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
