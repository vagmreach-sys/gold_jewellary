import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const users = JSON.parse(
  readFileSync(path.join(__dirname, "../seed/users.json"), "utf8"),
) as Array<{ mobile: string; password: string; role: string; name: string }>;
const products = JSON.parse(
  readFileSync(path.join(__dirname, "../seed/products.json"), "utf8"),
) as Array<{
  slug: string;
  title: string;
  category: string;
  price: number;
  originalPrice: number;
  weight: string;
  stock: number;
  rating: number;
  imageSvg: string;
}>;

const sampleReviews = [
  { author: "Ananya R.", rating: 5, body: "Finish looks exactly like my solid gold set. Insured delivery was seamless." },
  { author: "Meera K.", rating: 4.9, body: "BIS-style card and weight feel premium. Will order bridal haram next." },
  { author: "Divya S.", rating: 4.8, body: "Fast dispatch and secure packaging. Highly recommend for festivals." },
];

async function main() {
  await prisma.paymentTransaction.deleteMany();
  await prisma.trackingEvent.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.reservationLine.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.address.deleteMany();
  await prisma.session.deleteMany();
  await prisma.otpChallenge.deleteMany();
  await prisma.user.deleteMany();
  await prisma.review.deleteMany();
  await prisma.productView.deleteMany();
  await prisma.product.deleteMany();

  for (const u of users) {
    const passwordHash = await hashPassword(u.password);
    await prisma.user.create({
      data: {
        mobile: u.mobile,
        passwordHash,
        role: u.role,
        name: u.name,
      },
    });
  }
  console.log(`Seeded ${users.length} users (admin: 9999999999 / admin123)`);

  for (const p of products) {
    const created = await prisma.product.create({ data: p });
    for (const r of sampleReviews) {
      await prisma.review.create({
        data: { productId: created.id, ...r, verified: true },
      });
    }
  }

  const demoProduct = await prisma.product.findFirst({ where: { slug: products[0].slug } });
  if (demoProduct) {
    const order = await prisma.order.create({
      data: {
        orderNumber: "VGM-2026-DEMO",
        status: "PAID",
        customerName: "Priya Nambiar",
        customerPhone: "9845012345",
        address: "Flat 402, Royal Palms, Jubilee Hills",
        pincode: "500033",
        city: "Hyderabad, Telangana",
        courier: "BlueDart Apex Air",
        subtotal: demoProduct.price,
        gst: Math.round(demoProduct.price * 0.03),
        grandTotal: demoProduct.price + Math.round(demoProduct.price * 0.03),
        checkoutSessionId: "VGM-DEMO",
        items: {
          create: [
            {
              productId: demoProduct.id,
              quantity: 1,
              price: demoProduct.price,
              title: demoProduct.title,
            },
          ],
        },
        shipment: {
          create: {
            awb: "BLUEDART-88219034IN",
            carrier: "BlueDart Apex Air",
            events: {
              create: [
                {
                  title: "Consignment In Armored Transit",
                  description: "Departed Hyderabad Vault Hub • Flight AI-840 Express",
                  occurredAt: new Date(),
                  sortOrder: 1,
                },
                {
                  title: "Gold Hallmark & Weight Laser Verified",
                  description: "Tamper-evident barcode serial attached",
                  occurredAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
                  sortOrder: 2,
                },
                {
                  title: "Out for Secure Delivery",
                  description: "OTP handshake will be requested upon arrival",
                  occurredAt: new Date(Date.now() + 20 * 60 * 60 * 1000),
                  sortOrder: 0,
                },
              ],
            },
          },
        },
      },
    });
    console.log("Demo tracking order:", order.orderNumber);
  }

  console.log(`Seeded ${products.length} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
