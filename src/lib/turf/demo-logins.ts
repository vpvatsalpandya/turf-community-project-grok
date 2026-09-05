export type DemoRole = "player" | "staff" | "manager" | "owner" | "admin";

export type DemoLogin = {
  role: DemoRole;
  id: string;
  name: string;
  email: string;
  password: string;
  home: "/play" | "/desk" | "/admin";
  cta: string;
  blurb: string;
};

/** Public demo desks — one-tap on sign-in. Not for production owners. */
export const DEMO_LOGINS: DemoLogin[] = [
  {
    role: "player",
    id: "user-demo-player",
    name: "Aarav Shah",
    email: "player@turfcommunity.in",
    password: "player1234",
    home: "/play",
    cta: "My night",
    blurb: "See your slot requests. Book a ground without creating a wallet.",
  },
  {
    role: "staff",
    id: "user-demo-staff",
    name: "Gate — Greenfield",
    email: "staff@turfcommunity.in",
    password: "staff1234",
    home: "/desk",
    cta: "Open gate",
    blurb: "Tonight’s board only. Confirm after UPI, walk-ins, In / Out / no-show.",
  },
  {
    role: "manager",
    id: "user-demo-manager",
    name: "Manager — Greenfield",
    email: "manager@turfcommunity.in",
    password: "manager1234",
    home: "/desk",
    cta: "Open desk",
    blurb: "Run the night and share the booking link. Cannot change UPI or price.",
  },
  {
    role: "owner",
    id: "user-demo-owner",
    name: "Greenfield desk",
    email: "owner@turfcommunity.in",
    password: "owner1234",
    home: "/desk",
    cta: "Open desk",
    blurb: "Full turf: board, share, UPI, photos, and gate logins for staff.",
  },
  {
    role: "admin",
    id: "user-demo-admin",
    name: "Turf Community HQ",
    email: "admin@turfcommunity.in",
    password: "admin1234",
    home: "/admin",
    cta: "Open HQ",
    blurb: "Every live turf on the platform, tonight’s bookings, directory coverage.",
  },
];

export function homeForRole(role: string): DemoLogin["home"] {
  if (role === "admin") return "/admin";
  if (role === "player") return "/play";
  return "/desk";
}

export function ctaForRole(role: string): string {
  if (role === "admin") return "Open HQ";
  if (role === "player") return "My night";
  if (role === "staff") return "Open gate";
  if (role === "manager") return "Open desk";
  return "Open desk";
}

export function isDeskRole(role: string) {
  return role === "staff" || role === "manager" || role === "owner";
}

export function canShareLink(role: string) {
  return role === "manager" || role === "owner";
}

export function canEditTurf(role: string) {
  return role === "owner";
}

export function canManageTeam(role: string) {
  return role === "owner";
}

export function canConnectWa(role: string) {
  return role === "owner" || role === "admin";
}

export function roleLabel(role: string) {
  if (role === "staff") return "Gate staff";
  if (role === "manager") return "Manager";
  if (role === "owner") return "Owner";
  if (role === "admin") return "HQ";
  if (role === "player") return "Player";
  return role;
}
