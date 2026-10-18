// Instacart Developer Platform — "intent-to-cart" model: we POST a shopping
// list, we get back a URL. Elena taps it to pay. Grandma never sees the URL.
// Docs: https://docs.instacart.com/developer_platform_api
//
// For routine (auto-approved) orders in the demo, we skip Instacart and use
// our demo store + Visa mock. Instacart is for the "needs approval" branch
// where Elena is the one tapping pay anyway.

export type InstacartLineItem = {
  name: string;
  quantity: number;
  unit?: string;
};

export async function createShoppingListUrl(input: {
  title: string;
  lineItems: InstacartLineItem[];
  partnerLinkbackUrl?: string;
}): Promise<{ ok: true; url: string; mode: "live" | "mock" } | { ok: false; error: string }> {
  const apiKey = process.env.INSTACART_API_KEY;
  const base = process.env.INSTACART_API_URL ?? "https://connect.dev.instacart.tools";

  if (!apiKey) {
    // Mock mode for demos without the key wired up. URL is obviously fake but
    // the dashboard can still render it as a link so the flow is visible.
    const slug = encodeURIComponent(input.title).slice(0, 40);
    return { ok: true, url: `https://www.instacart.com/store/shopping-lists/mock-${slug}`, mode: "mock" };
  }

  const res = await fetch(`${base}/idp/v1/products/products_link`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      title: input.title,
      line_items: input.lineItems.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit ?? "each",
      })),
      ...(input.partnerLinkbackUrl ? { partner_linkback_url: input.partnerLinkbackUrl } : {}),
    }),
  });

  if (!res.ok) return { ok: false, error: `instacart ${res.status}: ${await res.text()}` };
  const data = (await res.json()) as { products_link_url: string };
  return { ok: true, url: data.products_link_url, mode: "live" };
}
