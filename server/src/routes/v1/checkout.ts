import { Router } from "express";
import { getCartId } from "../../lib/cartCookie.js";
import { fail, ok } from "../../lib/response.js";
import { validateCheckout } from "../../services/orders.js";
import { attachUser, requireAuth, type AuthedRequest } from "../../middleware/auth.js";

export const checkoutRouter = Router();

checkoutRouter.post("/validate", attachUser, requireAuth, async (req: AuthedRequest, res) => {
  try {
    const cartId = getCartId(req, res);
    const data = await validateCheckout({
      cartId,
      userId: req.user!.id,
      addressId: req.body.addressId,
      customerName: req.body.customerName,
      customerPhone: req.body.customerPhone,
      address: req.body.address,
      addressLine2: req.body.addressLine2,
      city: req.body.city,
      state: req.body.state,
      pincode: req.body.pincode,
      courier: req.body.courier,
    });
    return ok(res, data);
  } catch (e) {
    return fail(res, 400, e instanceof Error ? e.message : "Validation failed");
  }
});
