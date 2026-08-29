/** All money is integer paise. Never floats. */

export function paise(inr: number): number {
  return Math.round(inr * 100);
}

export function formatInr(paiseAmount: number): string {
  const rupees = Math.round(paiseAmount) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees);
}

export function formatInrCompact(paiseAmount: number): string {
  const rupees = Math.round(paiseAmount) / 100;
  if (Math.abs(rupees) >= 100000) {
    return `₹${(rupees / 100000).toFixed(rupees % 100000 === 0 ? 0 : 1)}L`;
  }
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(rupees)}`;
}

export function applyDiscount(params: {
  pricePaise: number;
  type: "percent" | "flat";
  value: number;
  maxDiscountPaise?: number | null;
}): { discountPaise: number; duePaise: number } {
  let discount =
    params.type === "percent"
      ? Math.floor((params.pricePaise * params.value) / 100)
      : Math.floor(params.value);
  if (params.maxDiscountPaise != null) {
    discount = Math.min(discount, params.maxDiscountPaise);
  }
  discount = Math.max(0, Math.min(discount, params.pricePaise));
  return { discountPaise: discount, duePaise: params.pricePaise - discount };
}
