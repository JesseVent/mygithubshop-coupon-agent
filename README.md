# The GitHub Shop checkout agent

Checkout assistant for thegithubshop.com built on `@github/copilot-sdk` with BYOK (OpenAI).

Your cart: Ugly Sweater v.2024 (L) $55.99, Mascot Cabana Shorts (M) $42.00, Mascot Cabana Top (L) $60.00. Subtotal $157.99, shipping **$74.26**, total $232.25 USD. The agent acknowledges the shipping and asks for a discount code. It checks codes with the `validate_coupon` tool, and all totals are calculated in code, not by the model.

## Demo

Real run against `gpt-5.4-mini`:

```
shop> You've got an Ugly Sweater v.2024 ($55.99), Mascot Cabana Shorts ($42.00), and a Mascot Cabana Top
      ($60.00) in your cart, for a subtotal of $157.99 and a total of $232.25 with $74.26 shipping. That
      shipping is pretty steep—I'm sorry about that. Do you have a discount code you'd like me to check?

you> FAKE
shop> Sorry, that code isn't valid — it's an unknown code. Your total stays $232.25 USD with $74.26 shipping.

you> whoisthisguy
shop> This guy is someone that really wants this ensemble but on principle refuses to pay that much for
      shipping dev merch. It gives 25% off merchandise plus free shipping, with a $39.50 discount,
      $0 shipping, and a total of $118.49 USD.
```

## Run it

```bash
bun install
echo 'OPENAI_API_KEY=sk-...' > .env   # MODEL=... to override gpt-5.4-mini
bun start
bun test
```

Codes (hardcoded in `agent.ts`): `SHIPITFREE` (free shipping), `OCTOCAT25` (25% off merchandise), `WHOISTHISGUY` (25% off + free shipping), `UGLY2023` (expired).
