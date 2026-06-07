import { AccountBar } from "@/components/account-bar";
import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { Footer } from "@/components/footer";
import { SectionHeading } from "@/components/section-heading";
import { ReputationPanel } from "@/components/reputation-panel";
import { PolicyConsole } from "@/components/policy-console";
import { GatePanel } from "@/components/gate-panel";
import { DemoFlow } from "@/components/demo-flow";
import { Primer } from "@/components/primer";

export default function Home() {
  return (
    <main className="min-h-screen bg-bg">
      <AccountBar />
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

      {/* YOUR POLICY — interactive console, live against on-chain reputation */}
      <section
        id="policy"
        className="border-b border-border bg-bg py-20 scroll-mt-16"
      >
        <div className="mx-auto max-w-3xl px-5">
          <SectionHeading
            eyebrow="Your control panel"
            title="Set your agent's policy. The gate re-decides live."
            subtitle="This is your agent's policy console. Adjust the minimum counterparty reputation and your spending caps, and every change is re-evaluated instantly against the live on-chain ERC-8004 reputation of the agent you're checking."
          />
          <PolicyConsole />
        </div>
      </section>

      {/* SECONDARY — try-it-yourself tools */}
      <section
        id="tools"
        className="border-b border-border bg-bg-neutral py-20 scroll-mt-16"
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
