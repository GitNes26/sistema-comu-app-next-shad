import * as React from "react";

import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/base/info-tooltip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface PageHeaderProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  className?: string;
}

// Encabezado de página consistente (título, breadcrumb, acciones).
export function PageHeader({
  icon,
  title,
  description,
  actions,
  breadcrumb,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-5 space-y-3", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumb.map((step, i) =>
              i === breadcrumb.length - 1 ? (
                <BreadcrumbItem key={step.label}>
                  <BreadcrumbPage>{step.label}</BreadcrumbPage>
                </BreadcrumbItem>
              ) : (
                <React.Fragment key={step.label}>
                  <BreadcrumbItem>
                    {step.href ? (
                      <BreadcrumbLink href={step.href}>{step.label}</BreadcrumbLink>
                    ) : (
                      <span>{step.label}</span>
                    )}
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </React.Fragment>
              )
            )}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          {icon && (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {icon}
            </span>
          )}
          <div>
            <h1 className="flex items-center gap-1.5 font-heading text-xl font-semibold leading-tight tracking-tight">
              {title}
              {description && <InfoTooltip text={description} className="align-middle" />}
            </h1>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}