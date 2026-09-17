/**
 * Smoke tests for positive/negative API edge cases.
 * Usage: npm run test:smoke (server must be running)
 */
const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:4000";
const API = `${BASE}/api/v1`;

type Result = { id: string; ok: boolean; detail: string };

async function req(
  path: string,
  init: RequestInit & { expectStatus?: number } = {},
): Promise<{ status: number; json: Record<string, unknown>; headers: Headers }> {
  const expectStatus = init.expectStatus ?? 200;
  const { expectStatus: _, ...fetchInit } = init;
  const res = await fetch(`${API}${path}`, {
    ...fetchInit,
    headers: {
      "Content-Type": "application/json",
      ...(fetchInit.headers as Record<string, string>),
    },
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }
  if (res.status !== expectStatus) {
    throw new Error(`expected HTTP ${expectStatus}, got ${res.status}: ${JSON.stringify(json)}`);
  }
  return { status: res.status, json, headers: res.headers };
}

function getSetCookie(headers: Headers): string[] {
  if (typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function") {
    return (headers as Headers & { getSetCookie: () => string[] }).getSetCookie();
  }
  const raw = headers.get("set-cookie");
  if (!raw) return [];
  return raw.split(/,(?=\s*[^;]+=)/);
}

function cookieHeaderFrom(setCookies: string[]): string {
  return setCookies
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function run(): Promise<void> {
  const results: Result[] = [];

  const pass = (id: string, detail: string) => results.push({ id, ok: true, detail });
  const fail = (id: string, detail: string) => results.push({ id, ok: false, detail });

  try {
    const health = await fetch(`${BASE}/health`);
    if (!health.ok) throw new Error("health not ok");
    pass("P-health", "/health OK");
  } catch (e) {
    fail("P-health", `Server not reachable at ${BASE}. Start: npm run dev. ${e}`);
    printResults(results);
    process.exit(1);
  }

  let firstProductId: number | null = null;
  try {
    const { json } = await req("/products");
    if (json.success !== true) throw new Error("products success false");
    const data = json.data as { id?: number; availableStock?: number; stock?: number }[];
    if (!Array.isArray(data) || data.length === 0) throw new Error("empty catalog");
    const pick =
      data.find((p) => (p.availableStock ?? p.stock ?? 0) > 0) ?? data[0];
    firstProductId = pick.id ?? null;
    if (firstProductId == null) throw new Error("no product id");
    pass("P1", `GET /products → ${data.length} items`);
  } catch (e) {
    fail("P1", String(e));
  }

  if (firstProductId != null) {
    try {
      const { json, headers } = await req("/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId: firstProductId, quantity: 1 }),
      });
      if (json.success !== true) throw new Error("cart add failed");
      const cookies = getSetCookie(headers);
      pass("P2", `Guest cart add OK (cookies: ${cookies.length > 0})`);
    } catch (e) {
      fail("P2", String(e));
    }
  } else {
    fail("P2", "Skipped (no product id from catalog)");
  }

  try {
    const { json } = await req("/shipping/pincode/500001");
    if (json.success !== true) throw new Error("pincode failed");
    pass("P4", "Pincode 500001 resolves");
  } catch (e) {
    fail("P4", String(e));
  }

  let customerCookie = "";
  try {
    const { json, headers } = await req("/auth/login/password", {
      method: "POST",
      body: JSON.stringify({ mobile: "9888888888", password: "customer123" }),
    });
    if (json.success !== true) throw new Error("login failed");
    const user = (json.data as { user?: { role?: string } })?.user;
    if (user?.role !== "CUSTOMER") throw new Error("wrong role");
    customerCookie = cookieHeaderFrom(getSetCookie(headers));
    pass("P7", "Customer password login + CUSTOMER role");
  } catch (e) {
    fail("P7", String(e));
  }

  try {
    await req("/me/addresses", {
      headers: { Cookie: customerCookie },
    });
    pass("P9-read", "GET /me/addresses with session");
  } catch (e) {
    fail("P9-read", String(e));
  }

  try {
    await req("/me/addresses", { expectStatus: 401 });
    pass("N2", "GET /me/addresses without session → 401");
  } catch (e) {
    fail("N2", String(e));
  }

  const newMobile = `98${String(Date.now()).slice(-8)}`;
  try {
    const { json, headers } = await req("/auth/register", {
      method: "POST",
      body: JSON.stringify({ mobile: newMobile, password: "testpass1", role: "ADMIN" }),
    });
    const user = (json.data as { user?: { role?: string; mobile?: string } })?.user;
    if (user?.role !== "CUSTOMER") throw new Error("role must be CUSTOMER from DB");
    if (user?.mobile !== newMobile) throw new Error("mobile mismatch");
    const regCookie = cookieHeaderFrom(getSetCookie(headers));
    if (!regCookie.includes("vgm_session")) throw new Error("no session cookie");
    pass("P-reg", `Password register new mobile → CUSTOMER (N5: role in body ignored)`);
  } catch (e) {
    fail("P-reg", String(e));
  }

  try {
    await req("/auth/register", {
      method: "POST",
      body: JSON.stringify({ mobile: "9888888888", password: "otherpass1" }),
      expectStatus: 400,
    });
    pass("N-reg-dup", "Duplicate mobile register → 400");
  } catch (e) {
    fail("N-reg-dup", String(e));
  }

  const otpMobile = `97${String(Date.now() + 1).slice(-8)}`;
  try {
    const { json: otpReqJson } = await req("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ mobile: otpMobile }),
    });
    const devOtp = (otpReqJson.data as { devOtp?: string })?.devOtp;
    if (!devOtp) throw new Error("OTP_DEV_MODE must be true for smoke OTP test");
    const { json: otpVerifyJson, headers: otpHeaders } = await req("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ mobile: otpMobile, otp: devOtp }),
    });
    const otpUser = (otpVerifyJson.data as { user?: { role?: string } })?.user;
    if (otpUser?.role !== "CUSTOMER") throw new Error("OTP user not CUSTOMER");
    pass("P19", "OTP request + verify creates CUSTOMER session");
    await req("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ mobile: otpMobile, otp: "000000" }),
      expectStatus: 401,
    });
    pass("N14", "Wrong OTP after valid verify → 401");
  } catch (e) {
    fail("P19/N14", String(e));
  }

  try {
    await req("/shipping/pincode/12345", { expectStatus: 400 });
    pass("N9", "Invalid pincode 12345 → 400");
  } catch (e) {
    fail("N9", String(e));
  }

  try {
    await req("/orders", {
      method: "POST",
      body: JSON.stringify({ cartId: "invalid", addressId: "x" }),
      expectStatus: 401,
    });
    pass("N1", "POST /orders without auth → 401");
  } catch (e) {
    fail("N1", String(e));
  }

  try {
    await req("/auth/login/password", {
      method: "POST",
      body: JSON.stringify({ mobile: "9888888888", password: "wrong-password" }),
      expectStatus: 401,
    });
    pass("N3", "Wrong password → 401");
  } catch (e) {
    fail("N3", String(e));
  }

  if (customerCookie) {
    try {
      await req("/admin/products", {
        headers: { Cookie: customerCookie },
        expectStatus: 403,
      });
      pass("N4", "Customer GET /admin/products → 403");
    } catch (e) {
      fail("N4", String(e));
    }
  } else {
    fail("N4", "Skipped (no customer session)");
  }

  try {
    await req("/products/999999", { expectStatus: 404 });
    pass("N6", "Unknown product → 404");
  } catch (e) {
    fail("N6", String(e));
  }

  let adminCookie = "";
  try {
    const { json, headers } = await req("/auth/login/password", {
      method: "POST",
      body: JSON.stringify({ mobile: "9999999999", password: "admin123" }),
    });
    if ((json.data as { user?: { role?: string } })?.user?.role !== "ADMIN") {
      throw new Error("not admin");
    }
    adminCookie = cookieHeaderFrom(getSetCookie(headers));
    pass("P14", "Admin login + ADMIN role");
  } catch (e) {
    fail("P14", String(e));
  }

  if (adminCookie) {
    try {
      const { json } = await req("/admin/products?limit=1", {
        headers: { Cookie: adminCookie },
      });
      if (json.success !== true) throw new Error("admin products failed");
      pass("P15-read", "Admin can list products");
    } catch (e) {
      fail("P15-read", String(e));
    }
  }

  printResults(results);
  const failed = results.filter((r) => !r.ok);
  process.exit(failed.length > 0 ? 1 : 0);
}

function printResults(results: Result[]) {
  console.log("\n=== VAGMREACH smoke edge cases ===\n");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id}  ${r.detail}`);
  }
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} passed\n`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
