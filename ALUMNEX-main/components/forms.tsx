"use client";
import { useState } from "react";
import { Button, ErrorBox, Field } from "./ui";
export type FormField = {
  name: string;
  label: string;
  type?: string;
  options?: string[];
  value?: string;
  required?: boolean;
  max?: number;
  hint?: string;
};
export function SimpleForm({
  fields,
  onSubmit,
  label = "Save changes",
  children,
}: {
  fields: FormField[];
  onSubmit: (
    data: Record<string, string>,
    form: HTMLFormElement,
  ) => Promise<void>;
  label?: string;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const form = e.currentTarget;
        try {
          await onSubmit(
            Object.fromEntries(new FormData(form)) as Record<string, string>,
            form,
          );
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error ? <ErrorBox message={error} /> : null}
      <div className="form-grid">
        {fields.map((f) => (
          <Field key={f.name} label={f.label} hint={f.hint}>
            {f.type === "textarea" ? (
              <textarea
                name={f.name}
                defaultValue={f.value || ""}
                required={f.required !== false}
                maxLength={f.max || 5000}
                rows={4}
              />
            ) : f.options ? (
              <select
                name={f.name}
                defaultValue={f.value || f.options[0]}
                required={f.required !== false}
              >
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={f.name}
                type={f.type || "text"}
                defaultValue={f.value || ""}
                required={f.required !== false}
                maxLength={f.max || 200}
                max={f.type === "number" ? 1000000000 : undefined}
                min={f.type === "number" ? 1 : undefined}
              />
            )}
          </Field>
        ))}
      </div>
      {children}
      <Button busy={busy} type="submit">
        {label}
      </Button>
    </form>
  );
}
