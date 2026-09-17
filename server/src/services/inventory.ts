import { prisma } from "../lib/prisma.js";

export const RESERVATION_TTL_SEC = 600;

export async function getReservedQty(productId: number): Promise<number> {
  const now = new Date();
  const lines = await prisma.reservationLine.findMany({
    where: {
      productId,
      reservation: { status: "ACTIVE", expiresAt: { gt: now } },
    },
  });
  return lines.reduce((s, l) => s + l.quantity, 0);
}

export async function getAvailableStock(productId: number): Promise<number> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return 0;
  const reserved = await getReservedQty(productId);
  return Math.max(0, product.stock - reserved);
}

export async function expireStaleReservations(): Promise<void> {
  const now = new Date();
  await prisma.reservation.updateMany({
    where: { status: "ACTIVE", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
}
