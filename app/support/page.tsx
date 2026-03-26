import Link from "next/link";
import { ArrowLeft, Brain, Mail, MessageSquare, PhoneCall, ShieldCheck } from "lucide-react";

const supportChannels = [
  {
    title: "Email Support",
    description: "Send us account issues, billing questions, or product feedback.",
    value: "support@studyflow.app",
    href: "mailto:support@studyflow.app",
    icon: Mail,
  },
  {
    title: "Live Assistance",
    description: "Chat with our team for onboarding help and urgent study-plan problems.",
    value: "Weekdays, 9 AM to 6 PM",
    href: "#",
    icon: MessageSquare,
  },
  {
    title: "Phone Line",
    description: "Use our support line for priority issues that block your workflow.",
    value: "+1 (800) 555-0148",
    href: "tel:+18005550148",
    icon: PhoneCall,
  },
];

const faqItems = [
  "Account access and password recovery",
  "Calendar sync and schedule-generation issues",
  "Subscription, billing, and trial questions",
  "Bug reports and feature requests",
];

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ede7ff,_#f7f7fb_45%,_#ffffff_100%)] px-5 py-10 text-[#0f1b14]">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-medium text-black/70 transition-colors duration-200 hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <section className="mt-8 grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] border border-white/70 bg-white/85 p-8 shadow-[0_30px_80px_rgba(58,27,109,0.10)] backdrop-blur">
            <div className="inline-flex items-center gap-3 rounded-full border border-[#7c3aed]/20 bg-[#f4efff] px-4 py-2 text-sm font-semibold text-[#5b2aa6]">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[#7c3aed] text-white">
                <Brain className="h-4 w-4" />
              </div>
              StudyFlow Support
            </div>

            <h1 className="mt-6 max-w-2xl text-4xl font-extrabold leading-tight md:text-5xl">
              Contact support when you need a real answer, fast.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-black/60">
              Reach the StudyFlow team for account help, scheduling issues, billing questions,
              or product feedback. We aim to respond within one business day.
            </p>

            <div className="mt-8 grid gap-4">
              {supportChannels.map((channel) => {
                const Icon = channel.icon;

                return (
                  <a
                    key={channel.title}
                    href={channel.href}
                    className="group flex items-start gap-4 rounded-3xl border border-black/5 bg-[#fcfbff] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#7c3aed]/20 hover:shadow-[0_18px_35px_rgba(124,58,237,0.12)]"
                  >
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f1edff] text-[#5b46d6]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-base font-semibold">{channel.title}</p>
                      <p className="mt-1 text-sm leading-6 text-black/55">{channel.description}</p>
                      <p className="mt-3 text-sm font-semibold text-[#5b46d6] transition-colors duration-200 group-hover:text-[#4527a7]">
                        {channel.value}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[28px] bg-[#2b135a] p-7 text-white shadow-[0_24px_64px_rgba(43,19,90,0.28)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                <ShieldCheck className="h-4 w-4" />
                Support Hours
              </div>
              <p className="mt-5 text-3xl font-bold">Monday to Friday</p>
              <p className="mt-2 text-sm leading-6 text-white/70">
                9:00 AM to 6:00 PM, Eastern Time. Critical account issues are prioritized first.
              </p>
            </div>

            <div className="rounded-[28px] border border-black/5 bg-white p-7 shadow-[0_20px_50px_rgba(15,27,20,0.06)]">
              <h2 className="text-xl font-bold">What we can help with</h2>
              <div className="mt-5 space-y-3">
                {faqItems.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-black/5 bg-[#faf8ff] px-4 py-3 text-sm text-black/65"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
