import { expect, test } from "bun:test";
import { checkCoupon, toPrompt, viewCart } from "./agent";

test("toPrompt frames single tokens as codes", () => {
  expect(toPrompt(" whoisthisguy ")).toBe('The customer entered the discount code "whoisthisguy". Check it with validate_coupon.');
  expect(toPrompt("you call that a discount!")).toBe("you call that a discount!");
});

test("viewCart", () => {
  expect(viewCart()).toMatchObject({ subtotal: 157.99, shipping: 74.26, total: 232.25 });
});

test("checkCoupon", () => {
  expect(checkCoupon("SHIPITFREE")).toMatchObject({ valid: true, shipping: 0, total: 157.99 });
  expect(checkCoupon("  octocat25 ")).toMatchObject({ valid: true, discount: 39.5, total: 192.75 });
  expect(checkCoupon("whoisthisguy")).toMatchObject({ valid: true, discount: 39.5, shipping: 0, total: 118.49 });
  expect(checkCoupon("UGLY2023")).toMatchObject({ valid: false, reason: "code has expired", total: 232.25 });
  expect(checkCoupon("FAKE")).toMatchObject({ valid: false, reason: "unknown code", total: 232.25 });
});
