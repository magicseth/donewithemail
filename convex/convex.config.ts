import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import pushNotifications from "@convex-dev/expo-push-notifications/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import workflow from "@convex-dev/workflow/convex.config";

const app = defineApp();
app.use(agent);
app.use(pushNotifications);
app.use(workpool);
app.use(workflow);

export default app;
