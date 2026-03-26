"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Chrome,
  Eye,
  EyeOff,
  Github,
  Lock,
  Mail,
  RotateCw,
  Target,
  User,
} from "lucide-react";
import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

const featureItems = [
  {
    title: "AI-Powered Planning",
    desc: "Personalized study schedules based on your goals and deadlines.",
  },
  {
    title: "Track Your Progress",
    desc: "Visual analytics and insights to keep you motivated.",
  },
  {
    title: "Spaced Repetition",
    desc: "Smart review schedules for better retention.",
  },
];

const statItems = [
  { label: "10K+", info: "Active Students" },
  { label: "95%", info: "Success Rate" },
  { label: "50K+", info: "Study Sessions" },
  { label: "4.9★", info: "User Rating" },
];

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password || (mode === "signup" && !name.trim())) {
      setError("Please fill in all required fields.");
      return;
    }

    if (mode === "signup") {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        const signupResponse = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: normalizedEmail,
            password,
          }),
        });

        const signupData = await signupResponse.json();

        if (!signupResponse.ok) {
          setError(signupData.message ?? "Unable to create account.");
          return;
        }

        setSuccess("Account created. Signing you in...");
      }

      const loginResult = await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (loginResult?.error) {
        setError("Invalid email or password.");
        return;
      }

      router.push(loginResult?.url ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleMode() {
    setMode((currentMode) => (currentMode === "login" ? "signup" : "login"));
    setError("");
    setSuccess("");
  }

  return (
    <div className={`${plusJakarta.className} min-h-[100svh] bg-[#f4f0ff] text-[#1c1532]`}>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-36 -top-24 h-64 w-64 rounded-full bg-[#d9c8ff] blur-3xl opacity-70" />
        <div className="pointer-events-none absolute -right-28 top-16 h-56 w-56 rounded-full bg-[#c4f0ff] blur-3xl opacity-60" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#ffd7ef] blur-[110px] opacity-40" />

        <main className="relative mx-auto grid min-h-[100svh] max-w-6xl grid-cols-1 items-center gap-6 px-6 py-4 md:grid-cols-2 md:gap-8 md:py-6">
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#7c3aed] via-[#5c52f5] to-[#b261ff] text-white shadow-lg">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold">StudyFlow</p>
                <p className="text-sm text-black/50">Smart Study Planner</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5c46a8] shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#7c3aed]" />
                {mode === "login" ? "Welcome Back" : "Start Your Journey"}
              </p>
              <h1 className="text-3xl font-extrabold leading-tight md:text-4xl">
                {mode === "login"
                  ? "Plan smarter. Learn faster."
                  : "Start your journey to success"}
              </h1>
              <p className="max-w-xl text-sm text-black/60">
                {mode === "login"
                  ? "Sign in to continue your learning journey with AI-powered study planning."
                  : "Join thousands of students achieving their goals with personalized scheduling."}
              </p>
            </div>

            <div className="relative min-h-[240px]">
              <div
                className={`absolute inset-0 space-y-4 transition-all duration-300 ease-out ${
                  mode === "login"
                    ? "opacity-100 translate-y-0"
                    : "pointer-events-none opacity-0 -translate-y-2"
                }`}
              >
                {featureItems.map((item, index) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/70 p-3 shadow-sm"
                  >
                    <div className="mt-1 grid h-8 w-8 place-items-center rounded-xl bg-[#eef2ff] text-[#5b46d6]">
                      {index === 0 && <Target className="h-4 w-4" />}
                      {index === 1 && <BarChart3 className="h-4 w-4" />}
                      {index === 2 && <RotateCw className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-[11px] text-black/50">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className={`absolute inset-0 grid grid-cols-2 gap-3 transition-all duration-300 ease-out ${
                  mode === "signup"
                    ? "opacity-100 translate-y-0"
                    : "pointer-events-none opacity-0 translate-y-2"
                }`}
              >
                {statItems.map((stat) => (
                  <div
                    key={stat.info}
                    className="flex flex-col items-center justify-center rounded-2xl border border-white/70 bg-white/70 p-3 text-center shadow-sm"
                  >
                    <p className="text-lg font-bold text-[#5b46d6]">{stat.label}</p>
                    <p className="text-xs text-black/50">{stat.info}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="w-full">
            <div className="rounded-[22px] border border-white/60 bg-white/80 p-5 shadow-xl backdrop-blur md:p-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold">
                  {mode === "login" ? "Welcome Back!" : "Create Account"}
                </h2>
                <p className="text-xs text-black/50">
                  {mode === "login"
                    ? "Sign in to continue your learning journey"
                    : "Start planning your study success today"}
                </p>
              </div>

              <form className="mt-4 space-y-2.5" onSubmit={handleSubmit}>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-out ${
                    mode === "signup"
                      ? "max-h-24 opacity-100"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <label className="block text-xs font-semibold text-black/60">
                    Full Name
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-1 shadow-sm">
                      <User className="h-4 w-4 text-black/40" />
                      <input
                        className="w-full text-sm text-black/80 outline-none placeholder:text-black/30"
                        placeholder="John Doe"
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        disabled={isSubmitting || mode === "login"}
                      />
                    </div>
                  </label>
                </div>

                <label className="block text-xs font-semibold text-black/60">
                  Email Address
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-1 shadow-sm">
                    <Mail className="h-4 w-4 text-black/40" />
                    <input
                      className="w-full text-sm text-black/80 outline-none placeholder:text-black/30"
                      placeholder="you@example.com"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </label>

                <label className="block text-xs font-semibold text-black/60">
                  Password
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-1 shadow-sm">
                    <Lock className="h-4 w-4 text-black/40" />
                    <input
                      className="w-full text-sm text-black/80 outline-none placeholder:text-black/30"
                      placeholder={mode === "login" ? "Enter your password" : "Create a strong password"}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-black/40 hover:text-black/60"
                      aria-label="Toggle password visibility"
                      disabled={isSubmitting}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                <div
                  className={`overflow-hidden transition-all duration-300 ease-out ${
                    mode === "signup"
                      ? "max-h-24 opacity-100"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <label className="block text-xs font-semibold text-black/60">
                    Confirm Password
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-1 shadow-sm">
                      <Lock className="h-4 w-4 text-black/40" />
                      <input
                        className="w-full text-sm text-black/80 outline-none placeholder:text-black/30"
                        placeholder="Confirm your password"
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        disabled={isSubmitting || mode === "login"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((prev) => !prev)}
                        className="text-black/40 hover:text-black/60"
                        aria-label="Toggle confirm password visibility"
                        disabled={isSubmitting}
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                </div>

                <div className="relative">
                  <div
                    className={`transition-all duration-300 ease-out ${
                      mode === "login"
                        ? "opacity-100 translate-y-0"
                        : "pointer-events-none opacity-0 -translate-y-2"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-black/50">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="h-3 w-3 rounded border-black/20" />
                        Remember me
                      </label>
                      <button type="button" className="text-[#5b46d6] hover:text-[#4b36c4]">
                        Forgot Password?
                      </button>
                    </div>
                  </div>

                  <div
                    className={`transition-all duration-300 ease-out ${
                      mode === "signup"
                        ? "opacity-100 translate-y-0"
                        : "pointer-events-none opacity-0 translate-y-2"
                    }`}
                  >
                    <label className="flex items-center gap-2 text-xs text-black/50">
                      <input type="checkbox" className="h-3 w-3 rounded border-black/20" />
                      I agree to the
                      <span className="text-[#5b46d6]">Terms of Service</span> and
                      <span className="text-[#5b46d6]">Privacy Policy</span>
                    </label>
                  </div>
                </div>

                {error ? (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                    {error}
                  </p>
                ) : null}

                {success ? (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                    {success}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4f7cff] via-[#6b5cff] to-[#9b34ff] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-200"
                >
                  {isSubmitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <div className="mt-4 flex items-center gap-3 text-[11px] text-black/40">
                <div className="h-px flex-1 bg-black/10" />
                <span>{mode === "login" ? "Or continue with" : "Or sign up with"}</span>
                <div className="h-px flex-1 bg-black/10" />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black/70"
                >
                  <Chrome className="h-4 w-4" />
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black/70"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                </button>
              </div>

              <p className="mt-4 text-center text-xs text-black/50">
                {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="font-semibold text-[#5b46d6] hover:text-[#4b36c4]"
                >
                  {mode === "login" ? "Sign Up" : "Sign In"}
                </button>
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
