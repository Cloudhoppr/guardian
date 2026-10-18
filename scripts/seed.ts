// Seeds a single family + a tiny catalog + 3 prescriptions. Idempotent-ish:
// safe to run twice because unique constraints prevent dupes on phone / sku.

import { db, schema } from "@/lib/db";
import { GRANDMA_PHONE_E164 } from "@/lib/demo";

const GROCERIES = [
  ["GRO-MILK-2PC", "2% Milk (gallon)", 429, ["milk"]],
  ["GRO-EGGS-DZ", "Large Eggs (dozen)", 349, ["eggs"]],
  ["GRO-BREAD-WG", "Whole Grain Bread", 329, ["bread"]],
  ["GRO-CER-BLU", "Blueberry Morning Cereal", 499, ["cereal", "blue box cereal"]],
  ["GRO-OATS", "Rolled Oats", 399, ["oats", "oatmeal"]],
  ["GRO-BANAN", "Bananas (bunch)", 149, ["bananas"]],
  ["GRO-APPLES", "Apples (3 lb)", 599, ["apples"]],
  ["GRO-CHIK-BR", "Chicken Breast (lb)", 749, ["chicken"]],
  ["GRO-RICE", "Jasmine Rice (2 lb)", 549, ["rice"]],
  ["GRO-PASTA", "Spaghetti", 199, ["pasta", "spaghetti"]],
  ["GRO-SAUCE", "Marinara Sauce", 329, ["pasta sauce"]],
  ["GRO-OJ", "Orange Juice", 429, ["oj", "orange juice"]],
  ["GRO-BUTTER", "Butter", 549, ["butter"]],
  ["GRO-CHEESE", "Cheddar Cheese", 599, ["cheese"]],
  ["GRO-YOGURT", "Greek Yogurt", 149, ["yogurt"]],
  ["GRO-COFFEE", "Ground Coffee", 899, ["coffee"]],
  ["GRO-TEA", "Black Tea Bags", 399, ["tea"]],
  ["GRO-SUGAR", "Sugar (4 lb)", 349, ["sugar"]],
  ["GRO-FLOUR", "All-Purpose Flour", 329, ["flour"]],
  ["GRO-SALT", "Table Salt", 149, ["salt"]],
  ["GRO-PEPPER", "Black Pepper", 299, ["pepper"]],
  ["GRO-TOMATO", "Tomatoes (lb)", 329, ["tomatoes"]],
  // Always "out of stock" — create_cart proposes a substitution for it.
  ["GRO-AVOCADO", "Avocados (4 ct)", 499, ["avocados", "avocado"]],
  ["GRO-LETTUCE", "Romaine Lettuce", 299, ["lettuce"]],
  ["GRO-CARROT", "Carrots (2 lb)", 249, ["carrots"]],
  ["GRO-POTATO", "Potatoes (5 lb)", 449, ["potatoes"]],
  ["GRO-ONION", "Yellow Onions (3 lb)", 329, ["onions"]],
  ["GRO-SOUP", "Chicken Noodle Soup", 229, ["soup"]],
  ["GRO-CRACK", "Saltine Crackers", 269, ["crackers"]],
  ["GRO-COOKIE", "Oatmeal Cookies", 399, ["cookies"]],
  ["GRO-ICE", "Vanilla Ice Cream", 549, ["ice cream"]],
] as const;

const OTC = [
  ["OTC-TYLE", "Tylenol Extra Strength", 899, ["tylenol", "acetaminophen"]],
  ["OTC-ADV", "Advil 200mg", 999, ["advil", "ibuprofen"]],
  ["OTC-ASP", "Aspirin 81mg", 549, ["aspirin"]],
  ["OTC-TUMS", "Tums Antacid", 649, ["tums", "antacid"]],
  ["OTC-PEPTO", "Pepto-Bismol", 749, ["pepto"]],
  ["OTC-COUGH", "Cough Syrup", 899, ["cough syrup", "robitussin"]],
  ["OTC-MULT", "Daily Multivitamin", 1299, ["vitamins", "multivitamin"]],
  ["OTC-VITD", "Vitamin D 1000IU", 999, ["vitamin d"]],
  ["OTC-CALC", "Calcium 600mg", 1099, ["calcium"]],
  ["OTC-FIBER", "Fiber Supplement", 1499, ["fiber", "metamucil"]],
  ["OTC-BANDAGE", "Adhesive Bandages", 449, ["bandages", "band-aids"]],
  ["OTC-ALCO", "Rubbing Alcohol", 299, ["alcohol"]],
  ["OTC-TPAPER", "Toilet Paper (6 pk)", 899, ["toilet paper"]],
  ["OTC-TISSUE", "Facial Tissues", 349, ["tissues", "kleenex"]],
  ["OTC-TOOTH", "Toothpaste", 549, ["toothpaste"]],
] as const;

async function main() {
  console.log("Seeding...");

  const [grandma] = await db
    .insert(schema.member)
    .values({
      fullName: "Ruth Alvarez",
      preferredName: "Ruth",
      phoneE164: GRANDMA_PHONE_E164,
      dateOfBirth: "1948-04-12",
      dietaryPrefs: ["low-sodium"],
      timezone: "America/Los_Angeles",
    })
    .onConflictDoNothing()
    .returning();
  const member = grandma ?? (await db.select().from(schema.member).limit(1))[0]!;

  await db
    .insert(schema.approver)
    .values({
      memberId: member.id,
      fullName: "Elena Alvarez",
      phoneE164: "+15559876543",
      email: "elena@example.com",
      role: "primary",
    })
    .onConflictDoNothing();

  await db
    .insert(schema.familyRules)
    .values({
      memberId: member.id,
      autoApproveUnderCents: 5000,
      dailySpendCapCents: 15000,
      frozen: 0,
    })
    .onConflictDoNothing();

  const products = [...GROCERIES.map((g) => ({ sku: g[0], name: g[1], category: "grocery" as const, priceCents: g[2], aliases: [...g[3]] })),
                    ...OTC.map((o) => ({ sku: o[0], name: o[1], category: "otc" as const, priceCents: o[2], aliases: [...o[3]] }))];
  await db.insert(schema.product).values(products).onConflictDoNothing();

  const all = await db.select().from(schema.product);
  const bySku = (s: string) => all.find((p) => p.sku === s)!;
  const usualSkus = ["GRO-MILK-2PC", "GRO-EGGS-DZ", "GRO-BREAD-WG", "GRO-CER-BLU", "GRO-BANAN", "GRO-OJ", "GRO-COFFEE", "GRO-YOGURT", "GRO-CHIK-BR", "GRO-SOUP"];
  await db
    .insert(schema.usualItem)
    .values(usualSkus.map((s) => ({ memberId: member.id, productId: bySku(s).id, typicalQuantity: 1 })))
    .onConflictDoNothing();

  const [pharmacy] = await db
    .insert(schema.pharmacy)
    .values({ name: "CVS on Westwood Blvd", phoneE164: "+13105550199", address: "10800 Westwood Blvd, Los Angeles, CA" })
    .onConflictDoNothing()
    .returning();
  const ph = pharmacy ?? (await db.select().from(schema.pharmacy).limit(1))[0]!;

  await db
    .insert(schema.prescription)
    .values([
      { memberId: member.id, pharmacyId: ph.id, rxNumber: "RX-10234", drug: "Lisinopril 10mg", refillsLeft: 3, daysSupply: 30 },
      { memberId: member.id, pharmacyId: ph.id, rxNumber: "RX-10235", drug: "Metformin 500mg", refillsLeft: 2, daysSupply: 30 },
      { memberId: member.id, pharmacyId: ph.id, rxNumber: "RX-10236", drug: "Atorvastatin 20mg", refillsLeft: 0, daysSupply: 30 },
    ])
    .onConflictDoNothing();

  console.log("Done.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
