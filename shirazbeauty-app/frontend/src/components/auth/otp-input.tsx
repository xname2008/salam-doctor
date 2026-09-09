"use client";

import { useEffect, useRef } from "react";

import { toEnglishDigits } from "@/lib/utils";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}

/**
 * Segmented OTP field. The boxes are laid out left-to-right (dir="ltr") because
 * a numeric code reads left-to-right even inside a Persian RTL page.
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  invalid = false,
  disabled = false,
}: OtpInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  // Also fires when the parent clears the code after a rejected attempt, which
  // is exactly when the user wants the caret back in the first box.
  useEffect(() => {
    if (!value) inputs.current[0]?.focus();
  }, [value]);

  /**
   * Boxes are addressed by position, so a cleared middle box has to leave a
   * hole rather than shift the digits after it along. Spaces hold those holes
   * and are trimmed off the end.
   */
  function setDigit(index: number, digit: string) {
    const chars = value.padEnd(length, " ").split("");
    chars[index] = digit || " ";
    const joined = chars.join("").slice(0, length).trimEnd();
    onChange(joined);

    if (joined.length === length && !joined.includes(" ")) {
      onComplete?.(joined);
    }
  }

  function handleChange(index: number, raw: string) {
    const digits = toEnglishDigits(raw).replace(/\D/g, "");

    if (!digits) {
      setDigit(index, "");
      return;
    }

    if (digits.length > 1) {
      // Pasted or autofilled code: spread it across the boxes.
      const spread = digits.slice(0, length);
      onChange(spread);
      inputs.current[Math.min(spread.length, length - 1)]?.focus();
      if (spread.length === length) onComplete?.(spread);
      return;
    }

    setDigit(index, digits);
    if (index < length - 1) inputs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (value[index]?.trim()) {
        setDigit(index, "");
      } else if (index > 0) {
        setDigit(index - 1, "");
        inputs.current[index - 1]?.focus();
      }
      return;
    }
    // Arrow keys follow the visual (LTR) order of the boxes.
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      inputs.current[index + 1]?.focus();
    }
  }

  return (
    <div dir="ltr" className="flex justify-center gap-2 sm:gap-3">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          disabled={disabled}
          aria-label={`رقم ${index + 1} از ${length}`}
          value={(value[index] ?? "").trim()}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.target.select()}
          className={[
            "size-12 rounded-xl border bg-white text-center text-lg font-bold text-ink transition-all sm:size-14 sm:text-xl",
            "focus:outline-none focus:ring-2 focus:ring-azure/25",
            invalid
              ? "border-destructive focus:border-destructive"
              : "border-input focus:border-azure",
            disabled ? "opacity-60" : "",
          ].join(" ")}
        />
      ))}
    </div>
  );
}
