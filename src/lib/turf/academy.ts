export type AcademyField = {
  field: string;
  required: "needed" | "should" | "optional";
  example: string;
  why: string;
};

export type AcademyModule = {
  id: string;
  minutes: number;
  title: string;
  outcome: string;
  steps: string[];
  check: { q: string; a: string };
};

export type AcademyFaq = { q: string; a: string };

export const ACCOUNT_FIELDS: AcademyField[] = [
  {
    field: "Your name",
    required: "needed",
    example: "Ravi Patel",
    why: "Shown only on the owner account. Not printed on the public booking page.",
  },
  {
    field: "Email",
    required: "needed",
    example: "ravi@greenfield.turf",
    why: "This is the login. One email = one turf in this phase.",
  },
  {
    field: "Password",
    required: "needed",
    example: "8+ characters",
    why: "Email sign-up. You can also continue with Grok instead of a password.",
  },
];

export const TURF_FIELDS: AcademyField[] = [
  {
    field: "Name",
    required: "needed",
    example: "Greenfield Arena",
    why: "Becomes the booking URL, like /b/greenfield-arena. At least 2 characters.",
  },
  {
    field: "Area",
    required: "should",
    example: "Alkapuri",
    why: "Printed on the public page and WhatsApp share text so players know which ground.",
  },
  {
    field: "City",
    required: "should",
    example: "Vadodara",
    why: "Defaults to Vadodara if left blank. Shown next to the turf name.",
  },
  {
    field: "Pitches",
    required: "should",
    example: "2",
    why: "1 to 6. Two people can hold the same hour only if you have two pitches.",
  },
  {
    field: "₹ per hour",
    required: "should",
    example: "900",
    why: "₹100–₹20,000. Amount on a request is price × slot length. Default ₹800.",
  },
  {
    field: "Slot minutes",
    required: "should",
    example: "60, 90 or 120",
    why: "Only these three lengths. Anything else saves as 60 minutes.",
  },
  {
    field: "Opens / Closes",
    required: "should",
    example: "6 and 23",
    why: "Hours in IST, 24-hour clock. 23 means last kick-off must finish by 11pm.",
  },
  {
    field: "UPI id",
    required: "should",
    example: "greenfield@okaxis",
    why: "Shown after a player requests. No payment gateway. Leave blank only if they pay at the counter.",
  },
  {
    field: "Gate phone",
    required: "should",
    example: "9876543210",
    why: "10-digit Indian mobile. Players call this if they are lost or the floodlights are off.",
  },
  {
    field: "Notes on the public page",
    required: "optional",
    example: "Studs ok. Arrive 10 min early. Extra ball ₹50.",
    why: "House rules. Keep it short — it sits under the slot list.",
  },
];

export const NOT_COLLECTED = [
  "GSTIN, PAN, Aadhaar, or cancelled cheque",
  "Bank account — UPI id is enough",
  "A second turf on the same login",
  "Customer accounts — players book as guests",
  "A payment gateway or commission setup",
];

export const MODULES: AcademyModule[] = [
  {
    id: "why",
    minutes: 3,
    title: "Why the book is retired",
    outcome: "You can explain the product to a gate boy in one sentence.",
    steps: [
      "Players do not create an account. They open your link, pick an IST hour, and send a request with name + 10-digit mobile.",
      "The request holds the pitch as pending. Nobody else can take that hour on that pitch.",
      "They pay you on UPI, out of band. You open the desk, see the rupees, tap Confirm. Decline frees the slot.",
      "Walk-ins still exist. Empty slot → Walk-in → name + mobile → Confirm at gate.",
    ],
    check: {
      q: "Does Turf Community collect the money?",
      a: "No. UPI is between the player and you. The app only holds the slot until you confirm.",
    },
  },
  {
    id: "account",
    minutes: 3,
    title: "Open the owner account",
    outcome: "You can reach the desk from any phone.",
    steps: [
      "Tap I run a turf on the home page, or Sign in.",
      "New turf: Create an account. Fill your name, email, password (8+ characters). Or continue with Grok.",
      "You land on the desk. If there is no turf yet, it says Set the pitch.",
      "Desk → Team. Add a gate login (name, email, password) as staff or manager. Staff see Today only. Manager also shares the link. They cannot change UPI or price.",
      "One email runs one turf in this phase. Do not share the owner password with the whole dressing room.",
    ],
    check: {
      q: "Can two owners share one login for two grounds?",
      a: "Not in this phase. One owner account, one turf. Open a second email for a second ground. Gate staff and a manager can share this turf from Team.",
    },
  },
  {
    id: "sheet",
    minutes: 8,
    title: "Fill the turf sheet",
    outcome: "Your public page shows the right hours, price, and UPI.",
    steps: [
      "Desk → Turf (or Create turf). Name is the only hard required field. Fill the rest the same night.",
      "Area + city tell players where to drive. Pitches (1–6) decide how many sides can share an hour.",
      "₹ per hour is the list price. Slot length is 60, 90, or 120 minutes. Opens/Closes are IST hours (6 and 23 is a typical floodlit day).",
      "Paste the UPI id you actually receive on. Add the gate phone. Write two lines of notes: shoes, extra ball, arrive 10 minutes early.",
      "Save turf. The booking link is minted from the name. Changing the name later does not change an already-saved slug.",
    ],
    check: {
      q: "What if you leave UPI blank?",
      a: "Players are told to pay at the counter. You can still confirm. UPI on the page converts better.",
    },
  },
  {
    id: "share",
    minutes: 4,
    title: "Share the link, not a screenshot of the diary",
    outcome: "The status, the group, and the gate all point at one URL.",
    steps: [
      "Desk → Share. Copy the booking link. Put it in WhatsApp status, the captains’ group, and a printout at the entrance.",
      "Copy WhatsApp status gives a one-liner with name, area, city, and the URL.",
      "Open public page to see what players see. Try the demo turf at /b/demo if you want to feel the player side first.",
      "Do not take bookings in a second WhatsApp chat after the link is live. If they text you, send the link back.",
    ],
    check: {
      q: "Who creates the player account?",
      a: "Nobody. Name and mobile on the request is the whole identity.",
    },
  },
  {
    id: "night",
    minutes: 10,
    title: "Run a night",
    outcome: "You can clear a pending row in under 20 seconds.",
    steps: [
      "Today tab is the night board. Stats: pending requests, sides on the board, rupees on confirmed + checked-in.",
      "Request arrives → player is told to pay your UPI. When the ping hits PhonePe/GPay, tap Confirm. Wrong name or no pay → Decline.",
      "Confirmed sides show In on the slot row. Tap In when they walk through the gate (checked in). Tap Out when they leave.",
      "They never arrived → No-show. Rain / lights / fight → Cancel. Both free the hour.",
      "Empty future slot → Walk-in. Name + mobile → Confirm at gate. It is already confirmed — cash or UPI at the fence.",
      "Past hours are marked Passed. Players cannot request a slot that has already started.",
    ],
    check: {
      q: "Two requests for 9pm and you have one pitch. What happens?",
      a: "The first request holds it as pending. The second player is told the slot just filled.",
    },
  },
  {
    id: "rules",
    minutes: 5,
    title: "Rules that keep nights clean",
    outcome: "Gate staff can follow the SOP without calling you every time.",
    steps: [
      "Times are IST. Do not convert. If a captain says 9pm they mean 21:00 India.",
      "Pending is a hold. Treat it like cash on the table until you decline it.",
      "No-show: if they were confirmed and did not arrive, you can still mark the night from the board — do not re-sell a live confirmed hour until you decline/cancel.",
      "Rain, floodlight fail, fight: decline or cancel, refund UPI yourself, message the player from your own WhatsApp. The app does not chat.",
      "Print the SOP from this academy and tape it next to the UPI QR.",
    ],
    check: {
      q: "Does the app refund UPI?",
      a: "No. You refund from the same UPI app you collected on.",
    },
  },
];

export const SOP_SECTIONS: { title: string; beats: string[] }[] = [
  {
    title: "A. Go live — first 20 minutes",
    beats: [
      "Create the owner account (name, email, password) or continue with Grok.",
      "Desk → Create turf. Fill name, area, city, pitches, ₹/hour, 60/90/120, opens, closes, UPI, gate phone, notes.",
      "Save. Desk → Share → copy the booking link. Status, captains’ group, printed sheet at the gate.",
      "Send yourself a test request from /b/your-slug. Confirm it. Decline a dummy. You now know the loop.",
    ],
  },
  {
    title: "B. Before the first kick-off",
    beats: [
      "Open the desk on the night phone. Check Today for the date.",
      "Pending row with no UPI by 15 minutes before kick-off → call the number → Decline if they ghost.",
      "Floodlights, balls, first-aid, drinking water. Notes on the public page should match the real house rules.",
    ],
  },
  {
    title: "C. When a request lands",
    beats: [
      "Player sees: slot, pitch, amount, your UPI. They pay. They wait.",
      "You see: name, mobile, time, pitch, rupees, optional note.",
      "UPI matches name/amount → Confirm. Mismatch, duplicate, or no pay → Decline. The hour frees instantly.",
      "Do not confirm on a WhatsApp screenshot alone if the UPI id on the page is yours — check the actual credit.",
    ],
  },
  {
    title: "D. At the gate",
    beats: [
      "Ask the time they booked and the name on the request. Match the slot row.",
      "Confirmed → tap In. That is check-in.",
      "When they leave → tap Out. That is check-out. The hour is closed on the diary.",
      "Confirmed and they ghost → No-show. The hour frees.",
      "Rain, lights, fight on a confirmed hour → Cancel. Refund UPI yourself.",
      "They showed up without a request and the slot is Open → Walk-in → name + mobile → Confirm at gate.",
      "Slot full / already started → do not override. Sell the next open hour.",
    ],
  },
  {
    title: "E. Close of night",
    beats: [
      "Tonight rupees on the board is confirmed + checked-in for that IST day. Cash walk-ins are in that number too.",
      "Reconcile against PhonePe/GPay. The app is the diary, not the ledger.",
      "Leave pending rows for tomorrow only if kick-off is tomorrow. Same-night pending after close → Decline.",
    ],
  },
  {
    title: "F. If it breaks",
    beats: [
      "Double book: should not happen on one pitch. If a human overrode on WhatsApp, honour the confirmed row in the desk and refund the other UPI yourself.",
      "Wrong UPI pasted: edit Turf, save, tell the next player. Already-pending requests still show the old instruction — call them.",
      "Rain / lights: cancel, refund, do not make them play. Message from your own number.",
      "Fight / alcohol: you are the ground. The app will not mediate. Decline future hours for that mobile if needed by refusing at the gate.",
    ],
  },
];

export const FAQS: AcademyFaq[] = [
  {
    q: "What does an owner actually have to fill?",
    a: "To create the account: name, email, password (or Grok). To go live: turf name is required. Area, city, pitches, price, slot length, hours, UPI, gate phone, and notes should be filled the same night or the public page looks unfinished.",
  },
  {
    q: "Is UPI required?",
    a: "The form will save without it. Players are then told to pay at the counter. Put the UPI id you actually receive on — conversion is higher and you confirm from the phone, not the fence.",
  },
  {
    q: "Do I need a payment gateway, GSTIN, or KYC?",
    a: "No. Phase 1 is UPI out of band. No Razorpay, no commission, no GSTIN field. You already collect turf fees on PhonePe/GPay today — keep doing that.",
  },
  {
    q: "Can two sides book the same 9pm?",
    a: "Only if Pitches ≥ 2. Each request takes one pitch index. When pitches are full, the next player is told the slot just filled.",
  },
  {
    q: "What if they request and never pay?",
    a: "The slot stays pending and blocked. Wait a short window, call the mobile, then Decline. Declining frees the hour.",
  },
  {
    q: "What if they pay and I never confirm?",
    a: "They are still pending — they should not enter. Confirm as soon as UPI lands. If you miss it, they will call the gate phone.",
  },
  {
    q: "Can I change the turf name later?",
    a: "Yes, the display name updates. The booking slug is set on first save and stays, so old WhatsApp statuses keep working.",
  },
  {
    q: "Which times does the board use?",
    a: "Asia/Kolkata only. A slot that has started is past. Players cannot request it. Walk-in also uses those hours.",
  },
  {
    q: "Can I add a second ground?",
    a: "Not on the same login in this phase. Use a second owner account.",
  },
  {
    q: "How do walk-ins work?",
    a: "Today → open slot → Walk-in → name + mobile → Confirm at gate. It is stored as confirmed, source walk-in. Phone can be skipped at the gate in a rush (stored as zeros) — still take a name.",
  },
  {
    q: "What does In and Out mean?",
    a: "In is check-in — the side walked onto the pitch. Out is check-out — they left. Use both so you know who is on the floodlights right now.",
  },
  {
    q: "What are No-show and Cancel?",
    a: "No-show: confirmed, they never arrived, the hour frees. Cancel: rain, lights, or a fight on a confirmed hour. Refund UPI yourself. Decline is only for a pending request that has not been confirmed.",
  },
  {
    q: "Do staff need the owner password?",
    a: "No. Owner desk → Team → add a gate login as staff or manager. Staff see Today. Manager also shares the booking link. Only the owner edits UPI, price, and WhatsApp keys.",
  },
  {
    q: "Is there a customer login or chat?",
    a: "No. Players are guests. Chat is your WhatsApp. The app is the book and the hold.",
  },
  {
    q: "What is the demo turf?",
    a: "/b/demo is Greenfield Arena in Alkapuri, Vadodara. Anyone can request it. It is not your turf. Use it to train the gate before you share your own link.",
  },
  {
    q: "Who should I share this academy with?",
    a: "The person who sits at the entrance, the person who watches PhonePe, and you. Send them /learn. They do not need the owner password.",
  },
  {
    q: "Can I print this?",
    a: "Yes. Open Owner academy → SOP → Copy night card. Paste into WhatsApp or a sheet at the gate.",
  },
];

export const NIGHT_CARD = `TURF COMMUNITY — NIGHT CARD

1. Player opens our booking link. They pick a time. They send name + mobile.
2. That hour is HELD (pending). Do not sell it on WhatsApp.
3. They pay UPI to the id on the turf page.
4. Owner desk → Confirm if money landed. Decline if not. Decline frees the hour.
5. At the gate: match name + time. Tap In. When they leave, tap Out.
6. Confirmed and they ghost → No-show. Rain / lights → Cancel. Both free the hour.
7. No request + slot open → Walk-in → name + mobile → Confirm at gate.
8. Slot started or full → do not override. Next open hour only.
9. Rain / lights / fight → refund UPI yourself. The app does not pay anyone.

Times are IST. No player accounts. No gateway.`;

export function requiredLabel(level: AcademyField["required"]) {
  if (level === "needed") return "Needed";
  if (level === "should") return "Fill tonight";
  return "Optional";
}
