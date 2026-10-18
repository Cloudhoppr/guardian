import { brandFontVariables } from "./fonts";
import { GuardianHome } from "./components/landing/GuardianHome";

export default function LandingPage() {
  return (
    <main className={brandFontVariables}>
      <GuardianHome />
    </main>
  );
}
