"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function UnlockPage() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Wrong passcode");
      }
      router.replace("/sources");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="max-w-sm w-full">
        <div className="text-center">
          <div className="font-serif text-4xl tracking-tight">
            42<span className="text-primary">nights</span>
          </div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mt-1">
            Data Room
          </div>
        </div>
        <Input
          type="password"
          placeholder="Passcode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          required
          className="mt-10"
        />
        <Button
          type="submit"
          variant="primary"
          className="w-full mt-3"
          disabled={submitting || !code}
        >
          {submitting ? "Checking…" : "Unlock"}
        </Button>
      </form>
    </div>
  );
}
