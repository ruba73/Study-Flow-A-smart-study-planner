"use client";

import Link from "next/link";
import { ArrowRight, Play, Brain, BarChart3, Gauge, Activity } from "lucide-react";
import Section from "./components/section";
import FeatureCard from "./components/featureCard";
import FooterCol from "./components/FooterCol";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  function handleAuthClick(mode: "login" | "signup") {
    router.push(`/Auth?mode=${mode}`);
  }
  return (
    <div className="min-h-screen bg-[#f7f7fb] text-[#0f1b14]">
      {/* NAV */}
      <header className="border-b border-black/5 bg-white/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#7c3aed] text-white">
              <Brain className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold">StudyFlow</span>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-black/70 md:flex">
            <a className="hover:text-black" href="#platform">
              Calendar
            </a>
            <a className="hover:text-black" href="#solutions">
              Solutions
            </a>
            <Link className="transition-colors duration-200 hover:text-black" href="/support">
              Support
            </Link>
          </nav>

          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => handleAuthClick("login")} className="rounded-full border border-black/10 px-4 py-2 text-black/80 hover:text-black">
              Log In
            </button>
            <button onClick={() => handleAuthClick("signup")} className="rounded-full bg-[#7c3aed] px-4 py-2 font-semibold text-white shadow-sm">
              Sign Up
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <main>
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-5 py-12 md:grid-cols-2 md:py-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#7c3aed]/30 bg-[#f1edff] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#5b2aa6]">
              <span className="h-2 w-2 rounded-full bg-[#7c3aed]" />
              New: Streak System And Analytics
            </div>

            <h1 className="mt-6 text-5xl font-extrabold leading-[1.02] tracking-tight md:text-6xl">
              Master your exams with{" "}
              <span className="text-[#7c3aed]">AI precision</span>
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-black/65 md:text-base">
              Your personalized study schedule, generated in seconds based on your free time
              and subject difficulty. Stop planning, start learning.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button className="inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-semibold text-white shadow-sm">
                Generate My Schedule
                <ArrowRight className="h-4 w-4" />
              </button>
              <button className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-black/80">
                <Play className="h-4 w-4" />
                Watch Demo
              </button>
            </div>
          </div>

          {/* Mock Card */}
          <div className="relative">
            <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-black/40">
                <div className="flex gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#ff6b6b]" />
                  <span className="h-2 w-2 rounded-full bg-[#ffd166]" />
                  <span className="h-2 w-2 rounded-full bg-[#06d6a0]" />
                </div>
                <span>March 2024 Schedule</span>
              </div>

              <div className="grid grid-cols-7 gap-2 text-[10px] text-black/50">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="rounded-lg border border-black/5 bg-[#f5f7f6] p-2 text-center">
                    <div className="mb-2 text-[9px] font-semibold uppercase text-black/40">{d}</div>
                    <div className="h-10 rounded-md bg-white" />
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-black/10 bg-[#f7fbf8] p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#7c3aed] text-white">
                    <Brain className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold">Organic Chemistry Review</div>
                    <div className="text-[10px] text-black/50">02:00 PM - 04:30 PM</div>
                  </div>
                </div>
                <div className="h-4 w-4 rounded-full border border-black/20" />
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="border-y border-black/5 bg-white/60">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-8 text-center md:grid-cols-4">
            <Section label={"50k+"} info={"Active Students"}/>
            <Section label={"2.5M"} info={"Hours Optimized"}/>
            <Section label={"+15%"} info={"Avg. Grade Boost"}/>
            <Section label={"4.7/5"} info={"Avg. User Rating"}/>
          </div>
        </section> 

        {/* FEATURES */}
        <section id="solutions" className="mx-auto max-w-6xl px-5 py-14">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold md:text-4xl">The Smartest Way to Learn</h2>
              <p className="mt-3 max-w-2xl text-sm text-black/60 md:text-base">
                Engineered for academic success and cognitive efficiency. We don't just fill your
                calendar; we optimize your brainpower.
              </p>
            </div>
            <a className="inline-flex items-center gap-2 text-sm font-semibold text-[#7c3aed]" href="#features">
              View all features
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            <FeatureCard icon="Gauge" title="Dynamic Scheduling" desc="Life happens. StudyFlow automatically adjusts your study blocks when meetings or
                events pop up in your calendar."/>
            <FeatureCard icon="BarChart3" title="Difficulty Mapping" desc="Harder subjects get more focus during your peak energy hours, based on circadian
                rhythm analysis."/>
            <FeatureCard icon="Activity" title="Progress Analytics" desc="Visualize your mastery level with real-time analytics. Know exactly when you're
                ready for the exam."/>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-5 pb-16">
          <div className="rounded-[32px] bg-[#2b135a] p-10 text-center text-white md:p-12">
            <h3 className="text-3xl font-extrabold md:text-4xl">
              Ready to transform your{" "}
              <span className="text-[#b983ff]">study habits?</span>
            </h3>
            <p className="mt-3 text-sm text-white/70 md:text-base">
              Join thousands of students achieving better results with less stress.
              Start your 7-day free trial today.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => handleAuthClick("signup")}
                className="rounded-full bg-[#7c3aed] px-6 py-3 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#6c30dd]"
              >
                Get Started
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-black/5 bg-white/70">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-5 py-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[#7c3aed] text-white">
                <Brain className="h-4 w-4" />
              </div>
              <span className="text-base font-semibold">StudyFlow</span>
            </div>
            <p className="mt-3 text-sm text-black/60">
              Empowering the next generation of learners with artificial intelligence and
              behavioral science.
            </p>
          </div>

          <FooterCol title={"Product"} links={[{label:"Features",href:"#"},{label:"Dashboard",href:"#"},{label:"News",href:"#"}]}/>
          <FooterCol title={"Company"} links={[{label:"About Us",href:"#"},{label:"Careers",href:"#"}]}/>
          <FooterCol title={"Support"} links={[{label:"Help Center",href:"/support"},{label:"Community",href:"#"},{label:"Privacy",href:"#"}]}/>
        </div>

        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 pb-10 text-xs text-black/50 md:flex-row">
          <span>© 2024 StudyFlow Inc. All rights reserved.</span>
          <div className="flex gap-4">
            <a href="#" className="group inline-flex items-center transition-colors duration-200 hover:text-[#2b135a]">
              <span className="relative">
                Privacy Policy
                <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-current transition-transform duration-300 ease-out group-hover:scale-x-100" />
              </span>
            </a>
            <a href="#" className="group inline-flex items-center transition-colors duration-200 hover:text-[#2b135a]">
              <span className="relative">
                Terms of Service
                <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-current transition-transform duration-300 ease-out group-hover:scale-x-100" />
              </span>
            </a>
            <a href="#" className="group inline-flex items-center transition-colors duration-200 hover:text-[#2b135a]">
              <span className="relative">
                Cookie Settings
                <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-current transition-transform duration-300 ease-out group-hover:scale-x-100" />
              </span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
