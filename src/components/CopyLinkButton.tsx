"use client";
import { useState } from "react";
import { Copy, Check, Link2 } from "lucide-react";

interface Props {
  url: string;
  label?: string;
  variant?: "button" | "icon";
}

export default function CopyLinkButton({ url, label = "Copiar enlace", variant = "button" }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleCopy}
        title={label}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "4px",
          color: copied ? "#16a34a" : "#666",
        }}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 14px",
        borderRadius: "8px",
        border: "1px solid #ddd",
        background: copied ? "#f0fdf4" : "#fff",
        color: copied ? "#16a34a" : "#475569",
        fontWeight: 700,
        fontSize: "0.82rem",
        cursor: "pointer",
      }}
    >
      {copied ? <Check size={16} /> : <Link2 size={16} />}
      {copied ? "¡Copiado!" : label}
    </button>
  );
}
