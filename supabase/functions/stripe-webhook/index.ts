import Stripe from "https://esm.sh/stripe@16.12.0?target=denonext";
import { adminClient } from "../_shared/common.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, req.headers.get("stripe-signature")!, Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined, cryptoProvider);
  } catch (e) { return new Response(`Signature invalide: ${(e as Error).message}`, { status: 400 }); }

  const db = adminClient();
  const apply = async (sub: Stripe.Subscription, userId?: string) => {
    const patch = {
      status: sub.status === "active" || sub.status === "trialing" ? "active" : sub.status === "past_due" ? "past_due" : "canceled",
      stripe_customer_id: String(sub.customer),
      stripe_subscription_id: sub.id,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    const uid = userId ?? sub.metadata?.user_id;
    if (uid) await db.from("subscriptions").update(patch).eq("user_id", uid);
    else await db.from("subscriptions").update(patch).eq("stripe_subscription_id", sub.id);
  };

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.subscription) await apply(await stripe.subscriptions.retrieve(String(s.subscription)), s.client_reference_id ?? undefined);
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    await apply(event.data.object as Stripe.Subscription);
  }
  return new Response("ok");
});
