export type OrgStatus = "trialing" | "active" | "past_due" | "read_only" | "cancelled";
export type Role = "platform_admin" | "owner" | "manager" | "staff";
export type BookingState =
  | "requested"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "no_show"
  | "cancelled"
  | "declined"
  | "lapsed";
export type Channel = "link" | "staff" | "phone" | "walkin";
export type ReliabilityBadge = "Reliable" | "New" | "Has cancelled late" | "No-show risk";

export type Membership = {
  appUserId: string;
  userId: string;
  orgId: string;
  venueId: string | null;
  role: Role;
  displayName: string | null;
  email: string | null;
  isPlatformAdmin: boolean;
  orgStatus: OrgStatus;
  orgName: string;
};

export type VenuePublic = {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  timezone: string;
  address: string | null;
  city: string | null;
  amenities: string[];
  photos: { src: string; alt: string }[];
  upiId: string | null;
  contactPhone: string | null;
  requestWindowMinutes: number;
  status: string;
};

export type ResourceRow = {
  id: string;
  venueId: string;
  parentId: string | null;
  name: string;
  sport: string | null;
  slotMinutes: number;
  bufferMinutes: number;
  minSlots: number;
  maxSlots: number;
  isBookable: boolean;
  sortOrder: number;
  status: string;
};

export type SlotOffer = {
  resourceId: string;
  resourceName: string;
  sport: string | null;
  startISO: string;
  endISO: string;
  localDate: string;
  label: string;
  pricePaise: number;
  priceLabel: string | null;
  available: boolean;
  requestCount: number;
};

export type BookingRow = {
  id: string;
  refCode: string;
  venueId: string;
  resourceId: string;
  resourceName: string;
  identityId: string | null;
  profileId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  periodStart: string;
  periodEnd: string;
  localDate: string;
  state: BookingState;
  channel: Channel;
  pricePaise: number;
  discountPaise: number;
  loyaltyRedeemedPaise: number;
  amountDuePaise: number;
  amountCollectedPaise: number;
  paymentMode: string | null;
  paymentNote: string | null;
  requestExpiresAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  reliability: ReliabilityBadge | null;
  loyaltyCreditPaise: number;
};

export type WaitlistStatus = "waiting" | "notified" | "booked" | "cancelled";

export type WaitlistRow = {
  id: string;
  venueId: string;
  resourceId: string;
  resourceName: string;
  identityId: string | null;
  name: string;
  phone: string;
  localDate: string;
  periodStart: string;
  periodEnd: string;
  status: WaitlistStatus;
  notes: string | null;
  createdAt: string;
};

export const POLICY_DEFAULT = {
  cancelHours: 4,
  lateCancel: "Late cancel after 4 hours before start may affect future requests.",
  noShow: "No-shows are marked by staff only. The slot is released after that.",
  payment: "Pay the turf owner directly (UPI / cash). Your request is not a booking until they confirm.",
};
