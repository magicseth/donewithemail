import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import encryptedPii from "@convex-dev/encrypted-pii/convex.config";
import migrations from "@convex-dev/migrations/convex.config";
import pushNotifications from "@convex-dev/expo-push-notifications/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import selfStaticHosting from "@get-convex/self-static-hosting/convex.config.js";

const app = defineApp();
app.use(agent);
app.use(encryptedPii);
app.use(migrations);
app.use(pushNotifications);
app.use(workpool);
app.use(workflow);
app.use(selfStaticHosting);

export default app;
