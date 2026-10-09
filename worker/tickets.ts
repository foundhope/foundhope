// Works out a ticket purchase from what the customer picked, using the event in
// Sanity, never the price sent by the browser. Pure functions, so they can be
// tested without Stripe or the network.

import { dayLabel, londonToday, money } from './order';

export type TicketEvent = {
  _id: string;
  title: string;
  date: string;
  start?: string;
  sellTickets?: boolean;
  ticketPrice?: number;
  ticketsAvailable?: number;
};

export type TicketOrder = {
  eventId: string;
  title: string;
  dateLabel: string;
  qty: number;
  unit: number; // pence
  total: number; // pence
  left: number | null; // tickets still free after this order, null = no limit
};

export const MAX_PER_ORDER = 8;

export function buildTicketOrder(
  req: { eventId?: unknown; qty?: unknown },
  event: TicketEvent | null,
  sold: number,
  now = new Date(),
): { ok: true; order: TicketOrder } | { ok: false; error: string } {
  if (!event || !event.sellTickets || !(Number(event.ticketPrice) > 0)) {
    return { ok: false, error: 'Tickets for this event are not on sale online.' };
  }
  if (londonToday(now) > event.date) return { ok: false, error: 'This event has already happened.' };

  const qty = Number(req.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_PER_ORDER) {
    return { ok: false, error: `Please choose between 1 and ${MAX_PER_ORDER} tickets.` };
  }

  let left: number | null = null;
  if (event.ticketsAvailable != null) {
    const remaining = Math.max(0, event.ticketsAvailable - sold);
    if (remaining === 0) return { ok: false, error: 'Sorry, this event is sold out.' };
    if (qty > remaining) return { ok: false, error: `Sorry, only ${remaining} ticket${remaining === 1 ? ' is' : 's are'} left.` };
    left = remaining - qty;
  }

  const unit = Math.round(Number(event.ticketPrice) * 100);
  return {
    ok: true,
    order: {
      eventId: event._id,
      title: event.title,
      dateLabel: dayLabel(event.date) + (event.start ? `, ${event.start}` : ''),
      qty,
      unit,
      total: unit * qty,
      left,
    },
  };
}

export const ticketText = (o: TicketOrder) => `${o.qty} x ticket, ${o.title}, ${o.dateLabel}: ${money(o.total)}`;
