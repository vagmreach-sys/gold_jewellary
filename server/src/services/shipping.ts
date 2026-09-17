export function resolvePincode(pin: string): { city: string; state: string; hub: string } {
  if (pin.startsWith("50")) return { city: "Hyderabad", state: "Telangana", hub: "Hyderabad Hub" };
  if (pin.startsWith("40")) return { city: "Mumbai", state: "Maharashtra", hub: "Mumbai Metropolitan" };
  if (pin.startsWith("11")) return { city: "New Delhi", state: "Delhi", hub: "Delhi NCR" };
  if (pin.startsWith("60")) return { city: "Chennai", state: "Tamil Nadu", hub: "Chennai South" };
  if (pin.startsWith("56")) return { city: "Bengaluru", state: "Karnataka", hub: "Bangalore Tech Hub" };
  return { city: "Metro Delivery Zone", state: "India", hub: "Metro Delivery Zone" };
}

export function formatCityState(pin: string): string {
  const r = resolvePincode(pin);
  return `${r.city}, ${r.state}`;
}

export interface CourierOption {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  eta: string;
  status: string;
  recommended?: boolean;
}

export function getCourierRates(_cartSubtotal: number): CourierOption[] {
  return [
    {
      id: "bluedart_apex",
      name: "BlueDart Apex Air",
      price: 0,
      priceLabel: "FREE",
      eta: "Guaranteed 24-36h Delivery",
      status: "Priority Vault Pickup",
      recommended: true,
    },
    {
      id: "delhivery_surface",
      name: "Delhivery Surface",
      price: 0,
      priceLabel: "FREE",
      eta: "Estimated 2-3 Days",
      status: "Active Air Route",
    },
    {
      id: "dtdc_insured",
      name: "DTDC Insured",
      price: 0,
      priceLabel: "FREE",
      eta: "Estimated 3-4 Days",
      status: "Regional Hub Open",
    },
  ];
}

export function isValidIndianPincode(pin: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pin);
}
