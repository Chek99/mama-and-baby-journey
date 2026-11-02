import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";

/** 6-digit code with auto-focus and auto-advance. Calls onComplete when full. */
export function CodeInput({
  id,
  value,
  onChange,
  onComplete,
  disabled,
  label,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onComplete?: ((v: string) => void) | undefined;
  disabled?: boolean | undefined;
  label: string;
  describedBy?: string | undefined;
}) {
  return (
    <InputOTP
      id={id}
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      autoFocus
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern={REGEXP_ONLY_DIGITS}
      aria-label={label}
      aria-describedby={describedBy}
      containerClassName="justify-center"
    >
      <InputOTPGroup className="gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <InputOTPSlot key={i} index={i} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
