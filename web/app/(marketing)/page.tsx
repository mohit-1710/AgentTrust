import AskAgentTrustSection from "@/components/AskAgentTrustSection";
import BenchmarkSection from "@/components/BenchmarkSection";
import ExploreSection from "@/components/ExploreSection";
import FooterSection from "@/components/FooterSection";
import Hero from "@/components/Hero";
import NetworkSection from "@/components/NetworkSection";
import PerformanceSection from "@/components/PerformanceSection";
import PlugAndPlaySection from "@/components/PlugAndPlaySection";
import ProgramsSection from "@/components/ProgramsSection";
import SectionMarkers from "@/components/SectionMarkers";
import StorytellingSection from "@/components/StorytellingSection";
import TopNav from "@/components/TopNav";
import TrilemmaSection from "@/components/TrilemmaSection";

export default function Home() {
  return (
    <>
      <TopNav />
      <SectionMarkers />
      <main aria-label="AgentTrust landing page">
        <Hero />
        <BenchmarkSection />
        <StorytellingSection />
        <ProgramsSection />
        <PerformanceSection />
        <PlugAndPlaySection />
        <NetworkSection />
        <TrilemmaSection />
        <ExploreSection />
        <AskAgentTrustSection />
        <FooterSection />
      </main>
    </>
  );
}
