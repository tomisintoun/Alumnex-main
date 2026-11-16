"use client";
import Link from "next/link";
import {
  ArrowRight,
  Network,
  Sparkles,
  X,
  LoaderCircle,
  Search,
  CircleAlert,
} from "lucide-react";
import {
  useEffect,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
export const Brand = ({ small = false }: { small?: boolean }) => (
  <Link href="/" className="brand" aria-label="ALUMNEX home">
    <Network size={small ? 24 : 30} />
    <span>
      ALUMNEX<small>ABUAD ALUMNI NETWORK</small>
    </span>
  </Link>
);
export function Button({
  children,
  busy = false,
  tone = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  tone?: string;
}) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className={"button " + tone + " " + (props.className || "")}
    >
      {busy ? <LoaderCircle className="spin" size={17} /> : null}
      {children}
    </button>
  );
}
export const Action = ({
  href,
  children,
  tone = "primary",
}: {
  href: string;
  children: ReactNode;
  tone?: string;
}) => (
  <Link className={"button " + tone} href={href}>
    {children}
  </Link>
);
export const Badge = ({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: string;
}) => <span className={"badge " + tone}>{children}</span>;
export const Avatar = ({
  index,
  name,
  size = 48,
}: {
  index?: number | null;
  name: string;
  size?: number;
}) => (
  <span
    className="avatar"
    role="img"
    aria-label={name}
    style={{
      width: size,
      height: size,
      ...(index !== null && index !== undefined
        ? {
            backgroundImage: "url(/portraits.jpg)",
            backgroundSize: "300% 200%",
            backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 100}%`,
          }
        : {}),
    }}
  >
    {index === null || index === undefined
      ? name
          .split(" ")
          .map((s) => s[0])
          .slice(0, 2)
          .join("")
      : null}
  </span>
);
export const Card = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => <section className={"card " + className}>{children}</section>;
export function Empty({
  title = "Nothing here yet",
  body,
  href,
  label,
}: {
  title?: string;
  body: string;
  href?: string;
  label?: string;
}) {
  return (
    <Card className="empty">
      <div className="empty-art">
        <Network size={44} />
        <i />
        <i />
      </div>
      <h2>{title}</h2>
      <p>{body}</p>
      {href ? (
        <Action href={href}>
          {label || "Explore the network"}
          <ArrowRight size={16} />
        </Action>
      ) : null}
    </Card>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="alert danger">
      <CircleAlert size={22} />
      <div>
        <strong>Something needs your attention</strong>
        <p>{message}</p>
        {retry ? (
          <button className="text-button" onClick={retry}>
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
export const Loading = () => (
  <div className="loading" role="status" aria-label="Loading">
    <div className="skeleton tall" />
    <div className="grid three">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
    <span className="sr-only">Loading your ABUAD network…</span>
  </div>
);
export const Insight = ({
  title,
  body,
  href,
  label = "Explore matches",
}: {
  title: string;
  body: string;
  href?: string;
  label?: string;
}) => (
  <section className="insight">
    <span className="eyebrow">
      <Sparkles size={16} /> ALUMNEX INTELLIGENCE
    </span>
    <h2>{title}</h2>
    <p>{body}</p>
    {href ? (
      <Action href={href} tone="secondary">
        {label}
        <ArrowRight size={16} />
      </Action>
    ) : null}
  </section>
);
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex="0"]',
          ) || [],
        );
        if (!nodes.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-heading">
          <h2>{title}</h2>
          <button
            autoFocus
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export const SearchBox = ({
  value,
  onChange,
  placeholder = "Search the ABUAD network…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => (
  <label className="search-box">
    <Search size={18} />
    <input
      aria-label={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </label>
);
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}
export function date(value: unknown) {
  if (!value) return "Not specified";
  const d = new Date(
    typeof value === "number"
      ? value
      : Number.isFinite(Number(value))
        ? Number(value)
        : String(value),
  );
  return Number.isNaN(d.getTime())
    ? "Not specified"
    : d.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}
export const money = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
export function statusTone(s: string) {
  return [
    "rejected",
    "declined",
    "closed",
    "blocked",
    "suspended",
    "expired",
  ].includes(s)
    ? "red"
    : [
          "accepted",
          "active",
          "paid",
          "published",
          "completed",
          "verified",
        ].includes(s)
      ? "green"
      : ["pending", "under_review", "draft"].includes(s)
        ? "amber"
        : "blue";
}
