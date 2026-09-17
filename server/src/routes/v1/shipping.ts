import { Router } from "express";
import { cartIdFromRequest } from "../../lib/cartCookie.js";
import { fail, ok } from "../../lib/response.js";
import { getCartPayload } from "../../services/cartService.js";
import {
  formatCityState,
  getCourierRates,
  isValidIndianPincode,
  resolvePincode,
} from "../../services/shipping.js";

export const shippingRouter = Router();

shippingRouter.get("/pincode/:pin", (req, res) => {
  const pin = req.params.pin.trim();
  if (!isValidIndianPincode(pin)) return fail(res, 400, "Invalid pincode");
  const loc = resolvePincode(pin);
  return ok(res, {
    pincode: pin,
    city: loc.city,
    state: loc.state,
    hub: loc.hub,
    cityState: formatCityState(pin),
  });
});

shippingRouter.get("/rates", async (req, res) => {
  const pincode = String(req.query.pincode ?? "").trim();
  if (!isValidIndianPincode(pincode)) return fail(res, 400, "Invalid pincode");

  let subtotal = 0;
  const cartId = cartIdFromRequest(req);
  if (cartId) {
    const cart = await getCartPayload(cartId);
    subtotal = cart.totals.subtotal;
  }

  const loc = resolvePincode(pincode);
  const couriers = getCourierRates(subtotal);
  const latencyMs = 20 + Math.floor(Math.random() * 20);

  return ok(res, {
    pincode,
    location: loc,
    cityState: formatCityState(pincode),
    couriers,
    apiStatus: { code: 200, latencyMs },
  });
});
