import { randomBytes } from "crypto";
import { prisma } from "../lib/prisma.js";
import { calcTotals, commitReservation, getCartPayload } from "./cartService.js";
import { formatCityState, getCourierRates, isValidIndianPincode } from "./shipping.js";
import { getAvailableStock } from "./inventory.js";

export function generateOrderNumber(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `VGM-2026-${n}`;
}

export function generateCheckoutSessionId(): string {
  return `VGM-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export type CheckoutAddressInput = {
  customerName: string;
  customerPhone: string;
  address: string;
  addressLine2?: string;
  city: string;
  state?: string;
  pincode: string;
};

export async function resolveAddressInput(
  userId: string,
  input: { addressId?: string } & Partial<CheckoutAddressInput>,
): Promise<CheckoutAddressInput> {
  if (input.addressId) {
    const addr = await prisma.address.findFirst({
      where: { id: input.addressId, userId },
    });
    if (!addr) throw new Error("Address not found");
    return {
      customerName: addr.recipientName,
      customerPhone: addr.phone,
      address: addr.line1,
      addressLine2: addr.line2 ?? undefined,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
    };
  }
  if (!input.customerName || !input.customerPhone || !input.address || !input.pincode) {
    throw new Error("Address or addressId required");
  }
  return {
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    address: input.address,
    addressLine2: input.addressLine2,
    city: input.city ?? formatCityState(input.pincode),
    state: input.state,
    pincode: input.pincode,
  };
}

export async function validateCheckout(input: {
  cartId: string;
  userId: string;
  addressId?: string;
  customerName?: string;
  customerPhone?: string;
  address?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  courier?: string;
}) {
  const resolved = await resolveAddressInput(input.userId, input);
  if (!resolved.customerName?.trim()) throw new Error("Name is required");
  if (!resolved.customerPhone?.trim()) throw new Error("Phone is required");
  if (!resolved.address?.trim()) throw new Error("Address is required");
  if (!isValidIndianPincode(resolved.pincode)) throw new Error("Invalid pincode");

  const cart = await getCartPayload(input.cartId);
  if (cart.items.length === 0) throw new Error("Cart is empty");

  for (const item of cart.items) {
    const avail = await getAvailableStock(item.productId);
    const inCart = item.quantity;
    if (inCart > avail + inCart) throw new Error(`Insufficient stock for ${item.title}`);
  }

  const couriers = getCourierRates(cart.totals.subtotal);
  const courierOk = input.courier
    ? couriers.some((c) => c.id === input.courier)
    : true;

  return {
    valid: true,
    city: resolved.city || formatCityState(resolved.pincode),
    couriers,
    totals: cart.totals,
    courierValid: courierOk,
    address: resolved,
  };
}

export async function createOrder(input: {
  cartId: string;
  userId: string;
  addressId?: string;
  customerName?: string;
  customerPhone?: string;
  address?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  courier: string;
}) {
  await validateCheckout(input);
  const resolved = await resolveAddressInput(input.userId, input);
  const cart = await getCartPayload(input.cartId);
  const checkoutSessionId = generateCheckoutSessionId();
  const orderNumber = generateOrderNumber();
  const courierMeta = getCourierRates(cart.totals.subtotal).find((c) => c.id === input.courier);

  const order = await prisma.order.create({
    data: {
      orderNumber,
      status: "PENDING_PAYMENT",
      userId: input.userId,
      cartId: input.cartId,
      customerName: resolved.customerName,
      customerPhone: resolved.customerPhone,
      address: resolved.address,
      addressLine2: resolved.addressLine2 ?? null,
      pincode: resolved.pincode,
      city: resolved.city || formatCityState(resolved.pincode),
      state: resolved.state ?? null,
      courier: courierMeta?.name ?? input.courier,
      subtotal: cart.totals.subtotal,
      gst: cart.totals.gst,
      shipping: 0,
      grandTotal: cart.totals.grandTotal,
      checkoutSessionId,
      items: {
        create: cart.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          price: i.price,
          title: i.title,
        })),
      },
    },
    include: { items: true },
  });

  return order;
}

export async function markOrderPaid(
  orderId: string,
  payment: { razorpayOrderId?: string; razorpayPaymentId?: string; idempotencyKey?: string },
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payments: true },
  });
  if (!order) throw new Error("Order not found");
  if (order.status === "PAID") {
    return prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { shipment: { include: { events: { orderBy: { sortOrder: "desc" } } } } },
    });
  }

  const idempotencyKey =
    payment.idempotencyKey ?? payment.razorpayPaymentId ?? `paid-${orderId}`;
  const existingTx = await prisma.paymentTransaction.findUnique({
    where: { idempotencyKey },
  });
  if (existingTx?.status === "CAPTURED") {
    return prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { shipment: { include: { events: { orderBy: { sortOrder: "desc" } } } } },
    });
  }

  for (const item of order.items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } },
    });
  }

  if (order.cartId) {
    await commitReservation(order.cartId);
    await prisma.cartItem.deleteMany({ where: { cartId: order.cartId } });
  }

  const awb = `BLUEDART-${Math.floor(10000000 + Math.random() * 89999999)}IN`;
  const now = new Date();

  await prisma.paymentTransaction.upsert({
    where: { idempotencyKey },
    create: {
      orderId,
      userId: order.userId,
      provider: payment.razorpayPaymentId ? "RAZORPAY" : "COD",
      amount: order.grandTotal,
      status: "CAPTURED",
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      idempotencyKey,
    },
    update: { status: "CAPTURED" },
  });

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "PAID",
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      shipment: {
        create: {
          awb,
          carrier: order.courier ?? "BlueDart Apex Air",
          events: {
            create: [
              {
                title: "Gold Hallmark & Weight Laser Verified",
                description: "Tamper-evident barcode serial attached",
                occurredAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
                sortOrder: 2,
              },
              {
                title: "Consignment In Armored Transit",
                description: "Departed Hyderabad Vault Hub • Flight AI-840 Express",
                occurredAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
                sortOrder: 1,
              },
              {
                title: "Out for Secure Delivery",
                description: "OTP handshake will be requested upon arrival",
                occurredAt: new Date(now.getTime() + 20 * 60 * 60 * 1000),
                sortOrder: 0,
              },
            ],
          },
        },
      },
    },
    include: { shipment: { include: { events: { orderBy: { sortOrder: "desc" } } } } },
  });

  return updated;
}

export async function confirmCod(orderId: string) {
  return markOrderPaid(orderId, {});
}
