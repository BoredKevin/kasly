import { registry } from "../registry";
import { BorderPayAdapter } from "./borderpay";

// Register default active adapters
if (!registry.has("borderpay")) {
  registry.register(new BorderPayAdapter());
}

export { BorderPayAdapter };
