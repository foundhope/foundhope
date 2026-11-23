// Works out a shop purchase (tote bags and the like) from what the customer
// picked, using the product in Sanity, never the price sent by the browser.
// Pure functions, so they can be tested without Stripe or the network.
// Everything bought here is collected from the shop.

import { money } from './order';

export type ShopProduct = {
  _id: string;
  name: string;
  price?: number;
  available?: boolean;
};

export type ShopOrder = {
  productId: string;
  name: string;
  qty: number;
  unit: number; // pence
  total: number; // pence
};

export const MAX_PER_ORDER = 10;

export function buildShopOrder(
  req: { productId?: unknown; qty?: unknown },
  product: ShopProduct | null,
): { ok: true; order: ShopOrder } | { ok: false; error: string } {
  if (!product || !(Number(product.price) > 0)) return { ok: false, error: 'Sorry, this is not on sale online.' };
  if (product.available === false) return { ok: false, error: `Sorry, ${product.name} has sold out.` };

  const qty = Number(req.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_PER_ORDER) {
    return { ok: false, error: `Please choose between 1 and ${MAX_PER_ORDER}.` };
  }
  const unit = Math.round(Number(product.price) * 100);
  return { ok: true, order: { productId: product._id, name: product.name, qty, unit, total: unit * qty } };
}

export const shopText = (o: ShopOrder) => `${o.qty} x ${o.name}: ${money(o.total)}`;
