import { registry } from "../registry";
import { BorderPayAdapter } from "./borderpay";
import { TemanQrisAdapter } from "./temanqris";

// Register default active adapters
if (!registry.has("borderpay")) {
  registry.register(new BorderPayAdapter());
}
if (!registry.has("temanqris")) {
  registry.register(new TemanQrisAdapter());
}

export { BorderPayAdapter, TemanQrisAdapter };

