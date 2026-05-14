// NOTE: This file previously contained an incomplete NextAuth config (`providers: []`).
// Keeping two different authOptions definitions breaks session fetching and can cause
// NextAuth client endpoints to return HTML/404 instead of JSON.
//
// All NextAuth configuration lives in the root-level `auth.ts`.
export * from "@/auth";

