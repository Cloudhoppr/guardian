import { brandFontVariables } from "./fonts";
import { FamilyDashboardCTA } from "./components/landing/FamilyDashboardCTA";
import { GuardianFeatureMap } from "./components/landing/GuardianFeatureMap";
import { HeroSection } from "./components/landing/HeroSection";
import { HowItWorksJourney } from "./components/landing/HowItWorksJourney";
import { PhoneDemoSection } from "./components/landing/PhoneDemoSection";

export default function LandingPage() {
  return (
    <main className={brandFontVariables}>
      <HeroSection />
      <GuardianFeatureMap />
      <PhoneDemoSection />
      <HowItWorksJourney />
      <FamilyDashboardCTA />
    </main>
  );
}
