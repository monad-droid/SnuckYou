"use client";

import { useState, FormEvent } from "react";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [productRequest, setProductRequest] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          product_request: productRequest.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
        return;
      }

      setStatus("success");
      setMessage("You're on the list! We'll reach out when we start tracking your requested products.");
      setEmail("");
      setProductRequest("");
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex items-center justify-center gap-3 py-4">
        <span className="material-symbols-outlined text-green-700">check_circle</span>
        <p className="font-body text-sm text-green-700 font-medium">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        required
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 bg-surface font-body text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
      <input
        type="text"
        placeholder="Products or brands to track (optional)"
        value={productRequest}
        onChange={(e) => setProductRequest(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-outline-variant/20 bg-surface font-body text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="px-8 py-3 bg-primary text-on-primary rounded-full text-sm font-headline font-bold hover:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
      >
        {status === "loading" ? "Joining..." : "Join Waitlist"}
      </button>
      {status === "error" && (
        <p className="font-body text-sm text-error">{message}</p>
      )}
    </form>
  );
}
