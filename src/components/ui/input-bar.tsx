import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ArrowUp, Square } from "lucide-react";

export type InputBarStatus = "ready" | "submitted" | "streaming" | "error";

export type InputBarProps = {
  onSend: (message: { role: "user"; content: string }) => void;
  onStop: () => void;
  status: InputBarStatus;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  leftActions?: ReactNode;
  rightActions?: ReactNode;
};

export const InputBar = memo(function InputBar({
  onSend,
  onStop,
  status,
  value: controlledValue,
  onChange,
  placeholder = "Send a message...",
  className,
  disabled = false,
  autoFocus = false,
  leftActions,
  rightActions,
}: InputBarProps) {
  const [internalValue, setInternalValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;
  const isWorking = status === "submitted" || status === "streaming";
  const canSend = value.trim().length > 0 && !disabled && !isWorking;

  const setValue = useCallback(
    (nextValue: string) => {
      if (isControlled) onChange?.(nextValue);
      else setInternalValue(nextValue);
    },
    [isControlled, onChange],
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
    textarea.style.overflowY = textarea.scrollHeight > 132 ? "auto" : "hidden";
  }, [value]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const send = useCallback(() => {
    const content = value.trim();
    if (!content || disabled || isWorking) return;
    onSend({ role: "user", content });
    setValue("");
  }, [disabled, isWorking, onSend, setValue, value]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className={["input-bar", className].filter(Boolean).join(" ")}>
      <textarea
        ref={textareaRef}
        aria-label="Message"
        rows={1}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      <div className="input-bar__toolbar">
        <div className="input-bar__actions">{leftActions}</div>
        <div className="input-bar__actions">
          {rightActions}
          {isWorking ? (
            <button type="button" className="input-bar__send" onClick={onStop} aria-label="Stop task">
              <Square size={15} fill="currentColor" />
            </button>
          ) : (
            <button type="button" className="input-bar__send" onClick={send} disabled={!canSend} aria-label="Run task">
              <ArrowUp size={20} strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

