"use client";

import { useEffect, useRef, useState } from "react";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Send } from "lucide-react";

export function ComposeBox({
  onSubmit,
  disabled,
  autofocus,
  placeholder = "Ask a question grounded in the data room…",
}: {
  onSubmit: (content: string) => Promise<void> | void;
  disabled?: boolean;
  autofocus?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autofocus) ref.current?.focus();
  }, [autofocus]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string") {
        setValue(detail);
        ref.current?.focus();
      }
    };
    window.addEventListener("compose:fill", handler);
    return () => window.removeEventListener("compose:fill", handler);
  }, []);

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    setValue("");
    await onSubmit(trimmed);
  }

  return (
    <form
      className="relative flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          const composing = (e.nativeEvent as KeyboardEvent).isComposing;
          if (
            (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ||
            (e.key === "Enter" && !e.shiftKey && !composing)
          ) {
            e.preventDefault();
            void submit();
          }
        }}
        rows={3}
        placeholder={placeholder}
        className="resize-none pr-12"
        disabled={disabled}
      />
      <Button
        type="submit"
        size="icon"
        variant="primary"
        disabled={disabled || !value.trim()}
        className="absolute bottom-2 right-2"
        title="Send (Enter)"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
