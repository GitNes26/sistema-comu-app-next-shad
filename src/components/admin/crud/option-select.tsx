"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FormCombobox, type ComboboxOption } from "@/components/base/form-combobox";
import { CrudCreateDialog } from "./crud-create-dialog";
import { crudApi } from "@/lib/api";
import type { CrudField } from "./crud-config";

export function OptionSelect({
  field,
  value,
  onChange,
  id,
  error,
  icon,
  infoTooltip,
}: {
  field: CrudField;
  value: string;
  onChange: (v: string) => void;
  id?: string;
  error?: string;
  icon?: ReactNode;
  infoTooltip?: ReactNode | null;
}) {
  const [options, setOptions] = useState<ComboboxOption[]>(field.options ?? []);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const valueKey = field.optionValue ?? "id";
  const labelKey = field.optionLabel ?? "name";

  const load = useCallback(async () => {
    if (!field.optionsModule) return;
    setLoading(true);
    try {
      if (field.optionsModule === "roles") {
        const response = await fetch("/api/settings/roles", { credentials: "include" });
        const payload = await response.json() as { roles?: { id: string; name: string }[] };
        if (!response.ok) throw new Error("No se pudieron cargar los roles");
        setOptions((payload.roles ?? []).map((role) => ({ value: role.id, label: role.name })));
        return;
      }
      const res = await crudApi.list(field.optionsModule, { pageSize: 250 });
      setOptions(
        res.rows.filter((r) => r.isActive !== false && r.active !== false).map((r) => ({
          value: String(r[valueKey] ?? ""),
          label: String(r[labelKey] ?? r.id ?? ""),
        }))
      );
    } catch {
      // Conserva las opciones visibles (incluida una recién creada) si una
      // sincronización posterior falla temporalmente.
    } finally {
      setLoading(false);
    }
  }, [field.optionsModule, valueKey, labelKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <FormCombobox
        id={id}
        label={field.label}
        required={field.required}
        helper={field.help}
        infoTooltip={infoTooltip}
        error={error}
        icon={icon}
        options={options}
        value={value ? String(value) : null}
        onChange={onChange}
        onSync={field.optionsModule ? load : undefined}
        onCreate={field.optionsModule ? () => setCreateOpen(true) : undefined}
        loading={loading}
        searchable={Boolean(field.optionsModule)}
        clearable={false}
        placeholder={loading ? "Cargando…" : field.placeholder ?? "Selecciona…"}
        searchPlaceholder="Buscar…"
        emptyText="Sin resultados"
      />
      {createOpen && field.optionsModule && (
        <CrudCreateDialog
          module={field.optionsModule}
          onClose={() => setCreateOpen(false)}
          onCreated={(record) => {
            const createdValue = String(record[valueKey] ?? record.id ?? "");
            const createdLabel = String(
              record[labelKey] ?? record.name ?? createdValue
            );
            if (createdValue) {
              setOptions((current) => {
                const next = { value: createdValue, label: createdLabel };
                const index = current.findIndex(
                  (option) => option.value === createdValue
                );
                if (index < 0) return [...current, next];
                return current.map((option, optionIndex) =>
                  optionIndex === index ? next : option
                );
              });
              onChange(createdValue);
            }
            setCreateOpen(false);
            void load();
          }}
        />
      )}
    </>
  );
}
