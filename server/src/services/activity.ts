let activeShoppers = 148;
let lastTick = Date.now();

export function getLiveActivity() {
  const now = Date.now();
  if (now - lastTick > 4000) {
    const variance = Math.floor(Math.random() * 7) - 3;
    activeShoppers = Math.max(120, activeShoppers + variance);
    lastTick = now;
  }
  return { activeShoppers, serverTime: new Date().toISOString() };
}
