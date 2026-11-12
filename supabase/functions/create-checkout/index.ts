import { authenticate, handle, HttpError } from "../_shared/common.ts";

Deno.serve(handle(async (req) => {
  const { successUrl, cancelUrl } = await req.json();
  const { admin, user } = await authenticate(req);
  const { data: sub } = await admin.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).single();

  const form = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": Deno.env.get("STRIPE_PRICE_ID")!,
    "line_items[0][quantity]": "1",
    client_reference_id: user.id,
    "subscription_data[metadata][user_id]": user.id,
    success_url: successUrl, cancel_url: cancelUrl,
    allow_promotion_codes: "true",
  });
  if (sub?.stripe_customer_id) form.set("customer", sub.stripe_customer_id);
  else if (user.email) form.set("customer_email", user.email);

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const s = await r.json();
  if (!r.ok) throw new HttpError(502, s.error?.message ?? "Erreur Stripe");
  return { url: s.url };
}));
