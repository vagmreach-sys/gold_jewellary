import { Router } from "express";
import { productsRouter } from "./products.js";
import { cartRouter } from "./cart.js";
import { shippingRouter } from "./shipping.js";
import { checkoutRouter } from "./checkout.js";
import { ordersRouter } from "./orders.js";
import { paymentsRouter } from "./payments.js";
import { trackingRouter } from "./tracking.js";
import { activityRouter } from "./activity.js";
import { authRouter } from "./auth.js";
import { meRouter } from "./me.js";
import { storefrontRouter } from "./storefront.js";
import { adminRouter } from "./admin/index.js";

export const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/me", meRouter);
v1Router.use("/storefront", storefrontRouter);
v1Router.use("/admin", adminRouter);
v1Router.use("/products", productsRouter);
v1Router.use("/cart", cartRouter);
v1Router.use("/shipping", shippingRouter);
v1Router.use("/checkout", checkoutRouter);
v1Router.use("/orders", ordersRouter);
v1Router.use("/payments", paymentsRouter);
v1Router.use("/tracking", trackingRouter);
v1Router.use("/activity", activityRouter);
