import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import assetsRouter from "./assets";
import transactionsRouter from "./transactions";
import accountsRouter from "./accounts";
import sipRouter from "./sip";
import settingsRouter from "./settings";
import dashboardRouter from "./dashboard";
import analyticsRouter from "./analytics";
import rebalancingRouter from "./rebalancing";
import opportunityRouter from "./opportunity";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/assets", assetsRouter);
router.use("/transactions", transactionsRouter);
router.use("/accounts", accountsRouter);
router.use("/sip", sipRouter);
router.use("/settings", settingsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/analytics", analyticsRouter);
router.use("/rebalancing", rebalancingRouter);
router.use("/opportunity", opportunityRouter);

export default router;
