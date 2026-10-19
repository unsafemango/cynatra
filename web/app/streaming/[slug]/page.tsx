import { landingRoute } from "@/components/landing/landingRoute";

// Landing pages like /streaming/netflix (list in lib/landing.ts).
const route = landingRoute("streaming");
export const generateMetadata = route.generateMetadata;
export default route.Page;
