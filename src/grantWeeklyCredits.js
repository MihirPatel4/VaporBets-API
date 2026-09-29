import db from './config/db.js';
import { getCurrentUtcWeekStart, grantWeeklyCredits } from './services/weeklyCreditGrant.js';

try {
  const weekStart = getCurrentUtcWeekStart();
  const usersGranted = await grantWeeklyCredits(weekStart);
  console.log(`Granted weekly Vaporcredits to ${usersGranted} users for ${weekStart}`);
}
catch (error) {
  console.error('Weekly Vaporcredits grant failed:', error);
  process.exitCode = 1;
}
finally {
  await db.end();
}