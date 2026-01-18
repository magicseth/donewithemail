import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import pushNotifications from "@convex-dev/expo-push-notifications/convex.config";

const app = defineApp();
app.use(agent);
app.use(pushNotifications);

export default app;
