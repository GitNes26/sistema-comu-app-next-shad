"use client";

import { useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CrudForm } from "./crud-form";
import { getCrudUi } from "./crud-config";
import { crudApi } from "@/lib/api";

// Diálogo reutilizable para crear un registro de un módulo CRUD (formulario completo).
// Lo abren los FormCombobox con "Agregar" en lugar del flujo inline "crear por nombre".
// El formId es único por instancia (useId) para soportar anidamiento de diálogos
// (p. ej. Caja → Sede, o Categoría → Categoría padre).
export function CrudCreateDialog({
  module,
  onClose,
  onCreated,
}: {
  module: string;
  onClose: () => void;
  onCreated: (record: Record<string, unknown>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const reactId = useId();
  const config = getCrudUi(module);

  if (!config) return null;

  const formId = `crud-create-${module}-${reactId.replace(/[:]/g, "")}`;

  return (
    <DialogComponent
      open
      onOpenChange={(o) => !o && onClose()}
      title="Nuevo"
      description={config.title}
      className="max-w-[90vw]"
      footerClassName="gap-2"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Crear
          </Button>
        </>
      }
    >
      <CrudForm
        config={config}
        initial={null}
        formId={formId}
        onSubmit={async (values) => {
          const res = await crudApi.create(module, values);
          onCreated(res.row ?? {});
        }}
        onSavingChange={setSaving}
        afterFields={config.afterFields}
      />
    </DialogComponent>
  );
}
