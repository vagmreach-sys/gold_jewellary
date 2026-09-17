import { Router } from "express";
import { attachUser, requireAuth } from "../../../middleware/auth.js";
import { adminProductsRouter } from "./products.js";
import { adminOrdersRouter } from "./orders.js";
import { adminShipmentsRouter } from "./shipments.js";

export const adminRouter = Router();
adminRouter.use(attachUser);
adminRouter.use(requireAuth);
adminRouter.use("/products", adminProductsRouter);
adminRouter.use("/orders", adminOrdersRouter);
adminRouter.use("/shipments", adminShipmentsRouter);
