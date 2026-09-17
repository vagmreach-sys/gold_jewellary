import { Router } from "express";
import { getCartId } from "../../lib/cartCookie.js";
import { fail, ok } from "../../lib/response.js";
import {
  addCartItem,
  clearCart,
  getCartPayload,
  releaseReservation,
  removeCartItem,
  reserveCart,
  updateCartItem,
} from "../../services/cartService.js";

export const cartRouter = Router();

cartRouter.get("/", async (req, res) => {
  const cartId = getCartId(req, res);
  const data = await getCartPayload(cartId);
  return ok(res, data);
});

cartRouter.post("/items", async (req, res) => {
  try {
    const cartId = getCartId(req, res);
    const productId = parseInt(String(req.body.productId), 10);
    const quantity = parseInt(String(req.body.quantity ?? 1), 10);
    if (Number.isNaN(productId) || quantity < 1) return fail(res, 400, "Invalid productId or quantity");
    const data = await addCartItem(cartId, productId, quantity);
    return ok(res, data);
  } catch (e) {
    return fail(res, 400, e instanceof Error ? e.message : "Could not add item");
  }
});

cartRouter.patch("/items/:productId", async (req, res) => {
  try {
    const cartId = getCartId(req, res);
    const productId = parseInt(req.params.productId, 10);
    const quantity = parseInt(String(req.body.quantity), 10);
    if (Number.isNaN(productId) || Number.isNaN(quantity)) return fail(res, 400, "Invalid input");
    const data = await updateCartItem(cartId, productId, quantity);
    return ok(res, data);
  } catch (e) {
    return fail(res, 400, e instanceof Error ? e.message : "Could not update item");
  }
});

cartRouter.delete("/items/:productId", async (req, res) => {
  const cartId = getCartId(req, res);
  const productId = parseInt(req.params.productId, 10);
  const data = await removeCartItem(cartId, productId);
  return ok(res, data);
});

cartRouter.delete("/", async (req, res) => {
  const cartId = getCartId(req, res);
  const data = await clearCart(cartId);
  return ok(res, data);
});

cartRouter.post("/reserve", async (req, res) => {
  const cartId = getCartId(req, res);
  const data = await reserveCart(cartId);
  return ok(res, data);
});

cartRouter.get("/reservation", async (req, res) => {
  const cartId = getCartId(req, res);
  const data = await getCartPayload(cartId);
  if (!data.reservation) return ok(res, { active: false, remainingSeconds: 0 });
  return ok(res, { active: true, ...data.reservation });
});

cartRouter.post("/reservation/release", async (req, res) => {
  const cartId = getCartId(req, res);
  const data = await releaseReservation(cartId);
  return ok(res, data);
});
