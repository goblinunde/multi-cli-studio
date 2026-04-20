import { useEffect, useRef, useState, type CSSProperties } from "react";

export function useModalErrorState(initialMessage: string | null = null) {
  const [message, setMessage] = useState<string | null>(initialMessage);
  const [scrollKey, setScrollKey] = useState(0);

  return {
    message,
    scrollKey,
    report(nextMessage: string) {
      setMessage(nextMessage);
      setScrollKey((prev) => prev + 1);
    },
    clear() {
      setMessage(null);
    },
    set(nextMessage: string | null) {
      setMessage(nextMessage);
      if (nextMessage) {
        setScrollKey((prev) => prev + 1);
      }
    },
  };
}

export function ModalErrorMessage({
  message,
  position = "top",
  style,
  className,
  scrollKey,
}: {
  message?: string | null;
  position?: "top" | "bottom";
  style?: CSSProperties;
  className?: string;
  scrollKey?: string | number;
}) {
  const errorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!message) return;
    const node = errorRef.current;
    if (!node) return;
    const frame = window.requestAnimationFrame(() => {
      node.scrollIntoView({
        behavior: "smooth",
        block: position === "bottom" ? "end" : "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [message, position, scrollKey]);

  if (!message) return null;

  return (
    <div
      ref={errorRef}
      role="alert"
      aria-live="assertive"
      className={className}
      style={{
        marginBottom: position === "top" ? 12 : 0,
        marginTop: position === "bottom" ? 12 : 0,
        padding: "8px 12px",
        background: "rgba(239, 68, 68, 0.12)",
        border: "1px solid rgba(239, 68, 68, 0.24)",
        borderRadius: 8,
        color: "#b91c1c",
        fontSize: 13,
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        ...style,
      }}
    >
      {message}
    </div>
  );
}

