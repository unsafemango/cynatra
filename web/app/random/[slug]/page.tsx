import { landingRoute } from "@/components/landing/landingRoute";

// Landing pages like /random/horror-movie (list in lib/landing.ts).
const route = landingRoute("random");
export const generateMetadata = route.generateMetadata;
export default route.Page;
