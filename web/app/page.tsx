import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { Footer } from "@/components/footer";
import { SectionHeading } from "@/components/section-heading";
import { ReputationPanel } from "@/components/reputation-panel";
import { GatePanel } from "@/components/gate-panel";
import { DemoFlow } from "@/components/demo-flow";
import { Primer } from "@/components/primer";

export default function Home() {
  return (
    <main className="min-h-screen bg-bg">
      <Navbar />
      <Hero />

      {/* CENTERPIECE — the block → allow walkthrough */}
      <section
        id="demo"
        className="relative border-b border-border bg-bg-neutral py-20 scroll-mt-16"
      >
        <div className="relative mx-auto max-w-6xl px-5">
          <SectionHeading
            eyebrow="The live demo"
            title="The scammer gets blocked. The trusted agent gets paid."
            subtitle="A guided two-step walkthrough, read live from PolicyVault on Monad testnet. Same payer, same amount — the only thing that changes is whether the payee's on-chain reputation clears the trust threshold."
          />
          <DemoFlow />
        </div>
      </section>

      {/* SECONDARY — try-it-yourself tools */}
      <section
        id="tools"
        className="border-b border-border bg-bg py-20 scroll-mt-16"
      >
        <div className="mx-auto max-w-6xl px-5">
          <SectionHeading
            eyebrow="Try it yourself"
            title="Look up reputation, run the gate"
            subtitle="The same two on-chain reads the demo uses, exposed as tools. Point them at any agent ID and attestor set and watch the verdict update live."
          />
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <ReputationPanel />
            <div id="gate" className="scroll-mt-20">
              <GatePanel />
            </div>
          </div>
        </div>
      </section>

      {/* CONTEXT — what the pieces are */}
      <section id="primer" className="bg-bg-neutral py-20 scroll-mt-16">
        <div className="mx-auto max-w-6xl px-5">
          <SectionHeading
            eyebrow="How it works"
            title="Three pieces, one verdict"
            subtitle="New to this? Here's what each part of AgentTrust does before a payment settles."
          />
          <Primer />
        </div>
      </section>

      <Footer />
    </main>
  );
}
