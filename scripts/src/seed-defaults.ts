import { db, usersTable, settingsTable, sipConfigsTable, pool } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEFAULT_USER_SETTINGS = {
  emergencyFundRequired: "500000",
  emergencyFundLowThreshold: "80",
  emergencyFundCriticalThreshold: "50",
  rebalancingDriftTolerance: "5",
  crashDropLevels: [10, 15, 20, 25] as number[],
  crashDeploymentStrategy: { "10": 25, "15": 50, "20": 75, "25": 100 } as Record<string, number>,
  currency: "LKR",
};

const DEFAULT_USER_SIP_CONFIG = {
  monthlyAmount: "0",
  equityPercent: "60",
  debtPercent: "20",
  metalsPercent: "10",
  opportunityPercent: "10",
  assetAllocations: [] as unknown[],
};

async function main() {
  const users = await db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable);
  console.log(`Found ${users.length} user(s).`);

  let settingsCreated = 0;
  let settingsBackfilled = 0;
  let sipCreated = 0;

  for (const user of users) {
    const [existingSettings] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.userId, user.id))
      .limit(1);

    if (!existingSettings) {
      await db.insert(settingsTable).values({ userId: user.id, ...DEFAULT_USER_SETTINGS });
      settingsCreated++;
      console.log(`  + Created settings for ${user.email}`);
    } else if (Number(existingSettings.emergencyFundRequired) === 0) {
      await db
        .update(settingsTable)
        .set({ emergencyFundRequired: DEFAULT_USER_SETTINGS.emergencyFundRequired })
        .where(eq(settingsTable.userId, user.id));
      settingsBackfilled++;
      console.log(`  ~ Backfilled emergency fund target for ${user.email}`);
    }

    const [existingSip] = await db
      .select()
      .from(sipConfigsTable)
      .where(eq(sipConfigsTable.userId, user.id))
      .limit(1);

    if (!existingSip) {
      await db.insert(sipConfigsTable).values({ userId: user.id, ...DEFAULT_USER_SIP_CONFIG });
      sipCreated++;
      console.log(`  + Created SIP config for ${user.email}`);
    }
  }

  console.log("");
  console.log("Done.");
  console.log(`  Settings created : ${settingsCreated}`);
  console.log(`  Settings backfilled : ${settingsBackfilled}`);
  console.log(`  SIP configs created : ${sipCreated}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
