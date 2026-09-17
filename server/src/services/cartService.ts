import { prisma } from "../lib/prisma.js";
import {
  expireStaleReservations,
  getAvailableStock,
  RESERVATION_TTL_SEC,
} from "./inventory.js";

const GST_RATE = 0.03;

export function calcTotals(subtotal: number) {
  const gst = Math.round(subtotal * GST_RATE);
  return { subtotal, gst, grandTotal: subtotal + gst };
}

async function ensureCart(cartId: string) {
  return prisma.cart.upsert({
    where: { id: cartId },
    create: { id: cartId },
    update: {},
  });
}

export async function getCartPayload(cartId: string) {
  await expireStaleReservations();
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: { include: { product: true } }, reservation: true },
  });
  if (!cart) {
    return {
      cartId,
      items: [],
      totals: calcTotals(0),
      reservation: null,
    };
  }

  const items = await Promise.all(
    cart.items.map(async (line) => {
      const availableStock = await getAvailableStock(line.productId);
      return {
        productId: line.productId,
        quantity: line.quantity,
        price: line.product.price,
        originalPrice: line.product.originalPrice,
        title: line.product.title,
        category: line.product.category,
        weight: line.product.weight,
        rating: line.product.rating,
        imageSvg: line.product.imageSvg,
        availableStock,
      };
    }),
  );

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const totals = calcTotals(subtotal);

  let reservation: {
    reservationId: string;
    expiresAt: string;
    remainingSeconds: number;
  } | null = null;

  if (
    cart.reservation &&
    cart.reservation.status === "ACTIVE" &&
    cart.reservation.expiresAt > new Date()
  ) {
    const remainingSeconds = Math.max(
      0,
      Math.floor((cart.reservation.expiresAt.getTime() - Date.now()) / 1000),
    );
    reservation = {
      reservationId: cart.reservation.id,
      expiresAt: cart.reservation.expiresAt.toISOString(),
      remainingSeconds,
    };
  }

  return { cartId, items, totals, reservation };
}

export async function addCartItem(cartId: string, productId: number, quantity: number) {
  await expireStaleReservations();
  await ensureCart(cartId);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");
  const reserved = await getAvailableStock(productId);
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId, productId } },
  });
  const inCart = existing?.quantity ?? 0;
  const maxAllowed = reserved + inCart;
  const newQty = inCart + quantity;
  if (newQty > maxAllowed) {
    throw new Error(`Only ${maxAllowed} unit(s) available for this item`);
  }

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    create: { cartId, productId, quantity },
    update: { quantity: newQty },
  });

  await createOrRefreshReservation(cartId);
  return getCartPayload(cartId);
}

export async function updateCartItem(cartId: string, productId: number, quantity: number) {
  await expireStaleReservations();
  if (quantity <= 0) {
    return removeCartItem(cartId, productId);
  }
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");
  const available = await getAvailableStock(productId);
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId, productId } },
  });
  const inCart = existing?.quantity ?? 0;
  const maxAllowed = available + inCart;
  if (quantity > maxAllowed) {
    throw new Error(`Only ${maxAllowed} unit(s) available`);
  }

  await prisma.cartItem.update({
    where: { cartId_productId: { cartId, productId } },
    data: { quantity },
  });
  await createOrRefreshReservation(cartId);
  return getCartPayload(cartId);
}

export async function removeCartItem(cartId: string, productId: number) {
  await prisma.cartItem.deleteMany({ where: { cartId, productId } });
  const remaining = await prisma.cartItem.count({ where: { cartId } });
  if (remaining === 0) {
    await releaseReservation(cartId);
  } else {
    await createOrRefreshReservation(cartId);
  }
  return getCartPayload(cartId);
}

export async function clearCart(cartId: string) {
  await prisma.cartItem.deleteMany({ where: { cartId } });
  await releaseReservation(cartId);
  return getCartPayload(cartId);
}

async function createOrRefreshReservation(cartId: string) {
  const items = await prisma.cartItem.findMany({
    where: { cartId },
    include: { product: true },
  });
  if (items.length === 0) return;

  const expiresAt = new Date(Date.now() + RESERVATION_TTL_SEC * 1000);

  const reservation = await prisma.reservation.upsert({
    where: { cartId },
    create: { cartId, expiresAt, status: "ACTIVE" },
    update: { expiresAt, status: "ACTIVE" },
  });

  await prisma.reservationLine.deleteMany({ where: { reservationId: reservation.id } });
  await prisma.reservationLine.createMany({
    data: items.map((i) => ({
      reservationId: reservation.id,
      productId: i.productId,
      quantity: i.quantity,
    })),
  });
}

export async function reserveCart(cartId: string) {
  await createOrRefreshReservation(cartId);
  return getCartPayload(cartId);
}

export async function releaseReservation(cartId: string) {
  await prisma.reservation.updateMany({
    where: { cartId, status: "ACTIVE" },
    data: { status: "RELEASED" },
  });
  return getCartPayload(cartId);
}

export async function commitReservation(cartId: string) {
  await prisma.reservation.updateMany({
    where: { cartId, status: "ACTIVE" },
    data: { status: "COMMITTED" },
  });
}
