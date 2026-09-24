import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { z } from "zod";
import { approveAll, CopilotClient, defineTool, ToolSet } from "@github/copilot-sdk";

// ponytail: cart and coupons hardcoded from one real checkout, swap for the Shopify cart/discount APIs
// Money is in cents so totals never pick up float error
const CART = [
  { item: "Ugly Sweater v.2024", size: "L", cents: 5599 },
  { item: "Mascot Cabana Shorts", size: "M", cents: 4200 },
  { item: "Mascot Cabana Top", size: "L", cents: 6000 },
];
const SHIPPING_CENTS = 7426;

interface Coupon {
  description: string;
  opener?: string;
  percentOff?: number;
  freeShipping?: boolean;
  expired?: boolean;
}

const COUPONS: Record<string, Coupon> = {
  SHIPITFREE: { description: "Free shipping", freeShipping: true },
  OCTOCAT25: { description: "25% off merchandise", percentOff: 25 },
  WHOISTHISGUY: {
    description: "25% off merchandise plus free shipping",
    opener:
      "This guy is someone that really wants this ensemble but on principle refuses to pay that much for shipping dev merch.",
    percentOff: 25,
    freeShipping: true,
  },
  UGLY2023: { description: "Free shipping (2023 holiday promo)", freeShipping: true, expired: true },
};

const dollars = (cents: number) => Math.round(cents) / 100;
const subtotalCents = CART.reduce((sum, line) => sum + line.cents, 0);

function totals(discountCents = 0, shippingCents = SHIPPING_CENTS) {
  return {
    subtotal: dollars(subtotalCents),
    discount: dollars(discountCents),
    shipping: dollars(shippingCents),
    total: dollars(subtotalCents - discountCents + shippingCents),
    currency: "USD",
  };
}

export function viewCart() {
  return { items: CART.map(({ cents, ...line }) => ({ ...line, price: dollars(cents) })), ...totals() };
}

export function checkCoupon(code: string) {
  const coupon = COUPONS[code.trim().toUpperCase()];
  if (!coupon) return { valid: false, reason: "unknown code", ...totals() };
  if (coupon.expired) return { valid: false, reason: "code has expired", ...totals() };
  const discountCents = Math.round((subtotalCents * (coupon.percentOff ?? 0)) / 100);
  const shippingCents = coupon.freeShipping ? 0 : SHIPPING_CENTS;
  return { valid: true, opener: coupon.opener, description: coupon.description, ...totals(discountCents, shippingCents) };
}

const SYSTEM_PROMPT = `You are the checkout assistant for The GitHub Shop (thegithubshop.com).
The customer has an Ugly Sweater v.2024, Mascot Cabana Shorts and a Mascot Cabana Top in their cart,
and has just been hit with a $74.26 USD shipping charge they are not happy about.
Open by calling view_cart, summarising the cart and total, acknowledging the shipping is steep,
and asking whether they have a discount code.
Always call validate_coupon to check a code and quote its numbers exactly; never do the maths yourself,
invent codes, or waive shipping without a valid coupon.
If validate_coupon returns an opener, start your reply with it word for word, then say "It gives" and the discount.
If a code is invalid, say why and let them try another. If they have none, be sympathetic but keep the price.
Keep replies to two or three short sentences.`;

export const KICKOFF = "The customer just saw $74.26 shipping at checkout.";

export type CouponResult = ReturnType<typeof checkCoupon>;

export function createShopSession(client: CopilotClient, onCoupon?: (code: string, result: CouponResult) => void) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Set OPENAI_API_KEY");

  return client.createSession({
    model: process.env.MODEL ?? "gpt-5.4-mini",
    // GPT-5 series needs the responses wire API
    provider: { type: "openai", baseUrl: "https://api.openai.com/v1", apiKey, wireApi: "responses" },
    systemMessage: { mode: "replace", content: SYSTEM_PROMPT },
    tools: [
      defineTool("view_cart", {
        description: "Show the customer's cart items, subtotal, shipping and total",
        parameters: z.object({}),
        skipPermission: true,
        handler: async () => viewCart(),
      }),
      defineTool("validate_coupon", {
        description: "Check a GitHub Shop discount code and return the recalculated order totals",
        parameters: z.object({ code: z.string().describe("Discount code the customer entered") }),
        skipPermission: true,
        handler: async ({ code }) => {
          const result = checkCoupon(code);
          onCoupon?.(code, result);
          return result;
        },
      }),
    ],
    // Only the shop tools: no shell or file access for a shop bot
    availableTools: new ToolSet().addCustom("view_cart").addCustom("validate_coupon"),
    onPermissionRequest: approveAll,
  });
}

async function main() {
  const client = new CopilotClient();
  const session = await createShopSession(client);

  session.on("assistant.message", (event) => {
    if (event.data.content) console.log(`\nshop> ${event.data.content}\n`);
  });

  const rl = createInterface({ input: stdin, output: stdout });
  // Grab the iterator now so lines typed/piped during the greeting are buffered
  const lines = rl[Symbol.asyncIterator]();
  try {
    await session.sendAndWait({ prompt: KICKOFF });
    stdout.write("you> ");
    for await (const raw of lines) {
      const line = raw.trim();
      if (line === "exit") break;
      if (line) await session.sendAndWait({ prompt: line });
      stdout.write("you> ");
    }
  } finally {
    rl.close();
    await session.disconnect();
    await client.stop();
  }
}

if (import.meta.main) await main();
