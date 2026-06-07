import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { Footer } from "@/components/footer";
import { SectionHeading } from "@/components/section-heading";
import { ReputationPanel } from "@/components/reputation-panel";
import { GatePanel } from "@/components/gate-panel";
import { DemoFlow } from "@/components/demo-flow";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />

      <section id="reputation" className="border-t border-border/40 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <SectionHeading
            eyebrow="Live on testnet"
            title="Reputation & the gate"
            subtitle="Read a payee's on-chain ERC-8004 reputation, then watch the policy gate turn that signal into a clear payment decision."
          />
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <ReputationPanel />
            <div id="gate" className="scroll-mt-20">
              <GatePanel />
            </div>
          </div>
        </div>
      </section>

      <section id="demo" className="relative border-t border-border/40 py-20">
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(50%_50%_at_50%_50%,#000,transparent)]" />
        <div className="relative mx-auto max-w-6xl px-5">
          <SectionHeading
            eyebrow="Stage demo"
            title="The scammer gets blocked. The trusted agent gets paid."
            subtitle="A guided two-step walkthrough you can run live on stage."
          />
          <DemoFlow />
        </div>
      </section>

      <Footer />
    </main>
  );
}
