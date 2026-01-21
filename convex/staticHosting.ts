import { exposeUploadApi, exposeDeploymentQuery } from "@get-convex/self-static-hosting";
import { components } from "./_generated/api";

// Internal functions - only callable via `npx convex run`
export const { generateUploadUrl, recordAsset, gcOldAssets, listAssets } =
  exposeUploadApi(components.selfStaticHosting);

// Optional: for live reload on deploy
export const { getCurrentDeployment } = exposeDeploymentQuery(
  components.selfStaticHosting,
);
