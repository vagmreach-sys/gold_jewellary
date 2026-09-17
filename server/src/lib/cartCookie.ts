import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

const CART_COOKIE = "cartId";

export function getCartId(req: Request, res: Response): string {
  let cartId = req.cookies[CART_COOKIE] as string | undefined;
  if (!cartId) {
    cartId = req.header("X-Cart-Id") ?? undefined;
  }
  if (!cartId) {
    cartId = uuidv4();
    res.cookie(CART_COOKIE, cartId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
  return cartId;
}

export function cartIdFromRequest(req: Request): string | undefined {
  return (req.cookies[CART_COOKIE] as string | undefined) ?? req.header("X-Cart-Id") ?? undefined;
}
