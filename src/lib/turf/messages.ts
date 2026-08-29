export const TEMPLATE_KINDS = [
  "request_received",
  "request_confirmed",
  "request_declined",
  "payment_reminder",
  "booking_reminder",
  "cancellation",
  "loyalty_earned",
  "waitlist_open",
] as const;

export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export type TemplateVars = {
  customer_name: string;
  venue: string;
  resource: string;
  date: string;
  time: string;
  duration: string;
  amount: string;
  ref_code: string;
  upi_id: string;
  venue_phone: string;
};

export const DEFAULT_TEMPLATES: Record<
  TemplateKind,
  { en: string; hi: string }
> = {
  request_received: {
    en: `Hi {customer_name}, we have your request for {venue} — {resource} on {date} at {time} ({duration}). Amount if confirmed: {amount}. This is a request, not a booking. We'll confirm after payment. UPI: {upi_id}. Ref: {ref_code}`,
    hi: `Namaste {customer_name}, {venue} — {resource} ke liye {date} {time} ({duration}) ka request aa gaya. Confirm hone par amount: {amount}. Ye booking nahi, request hai. Payment ke baad confirm hoga. UPI: {upi_id}. Ref: {ref_code}`,
  },
  request_confirmed: {
    en: `{customer_name}, you're confirmed at {venue} — {resource}. {date} {time} ({duration}). Paid/due: {amount}. UPI: {upi_id}. Show this ref at the gate: {ref_code}. See you on the turf.`,
    hi: `Namaste {customer_name}! Slot confirm ho gaya. {venue} — {resource}, {date} {time} ({duration}). Amount: {amount}. UPI: {upi_id}. Gate pe yeh ref dikhana: {ref_code}. Time pe aa jaana.`,
  },
  request_declined: {
    en: `Hi {customer_name}, your request for {venue} — {resource} on {date} at {time} could not be confirmed (the slot went to someone else or expired). Ref: {ref_code}. Please pick another time on the link.`,
    hi: `{customer_name}, {venue} — {resource} {date} {time} ka request confirm nahi ho paya — slot dusre ko mil gaya ya expire ho gaya. Ref: {ref_code}. Link se doosra time choose kar lo.`,
  },
  payment_reminder: {
    en: `{customer_name}, still waiting on payment for {venue} — {resource}, {date} {time}. Amount: {amount}. UPI: {upi_id}. We can only confirm after it lands. Ref: {ref_code}`,
    hi: `{customer_name}, {venue} — {resource} {date} {time} ka payment pending hai. Amount: {amount}. UPI: {upi_id}. Payment aate hi confirm. Ref: {ref_code}`,
  },
  booking_reminder: {
    en: `Reminder: {venue} — {resource} today at {time} ({duration}). Ref: {ref_code}. See you. {venue_phone}`,
    hi: `Reminder: aaj {time} par {venue} — {resource} ({duration}). Ref: {ref_code}. Milte hain. {venue_phone}`,
  },
  cancellation: {
    en: `{customer_name}, your slot at {venue} — {resource} on {date} {time} has been cancelled. Ref: {ref_code}.`,
    hi: `{customer_name}, {venue} — {resource} {date} {time} cancel ho gaya. Ref: {ref_code}.`,
  },
  loyalty_earned: {
    en: `{customer_name}, loyalty update at {venue}: you earned credit on {ref_code}. Next visit, ask the desk to apply it.`,
    hi: `{customer_name}, {venue} par loyalty credit add ho gaya (ref {ref_code}). Next visit pe desk se apply karwa lena.`,
  },
  waitlist_open: {
    en: `{customer_name}, a slot just opened at {venue} — {resource} on {date} at {time} ({duration}). First to pay gets it. UPI: {upi_id}. Call: {venue_phone}`,
    hi: `{customer_name}, {venue} — {resource} par {date} {time} ({duration}) ka slot khul gaya. Pehle payment, uska slot. UPI: {upi_id}. Call: {venue_phone}`,
  },
};

export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{([a-z_]+)\}/g, (_, k: string) => {
    const v = vars[k as keyof TemplateVars];
    return v == null || v === "" ? "—" : String(v);
  });
}

export const SHARE_HINT =
  "Copy and send from your own WhatsApp. Messages from a number the customer already trusts.";
