export const DEFAULT_USER_SETTINGS = {
  emergencyFundRequired: "500000",
  emergencyFundLowThreshold: "80",
  emergencyFundCriticalThreshold: "50",
  rebalancingDriftTolerance: "5",
  crashDropLevels: [10, 15, 20, 25] as number[],
  crashDeploymentStrategy: { "10": 25, "15": 50, "20": 75, "25": 100 } as Record<string, number>,
  currency: "LKR",
} as const;

export const DEFAULT_USER_SIP_CONFIG = {
  monthlyAmount: "0",
  equityPercent: "60",
  debtPercent: "20",
  metalsPercent: "10",
  opportunityPercent: "10",
  assetAllocations: [] as unknown[],
} as const;
