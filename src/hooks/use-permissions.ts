"use client"

import { useCallback, useEffect, useState } from "react"
import { PERMISSIONS } from "@/lib/auth/permission-keys"

const STORAGE_KEY = "custom-permissions"

export interface CustomPermission {
  key: string
  module: string
  action: string
  label: string
}

function loadCustom(): CustomPermission[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveCustom(perms: CustomPermission[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(perms))
}

export function usePermissions() {
  const [custom, setCustom] = useState<CustomPermission[]>([])

  useEffect(() => {
    setCustom(loadCustom())
  }, [])

  const allPermissions = [
    ...PERMISSIONS.map((p) => ({
      key: p.key,
      module: p.module,
      action: p.action,
      label: p.label,
      isCustom: false,
    })),
    ...custom.map((p) => ({
      key: p.key,
      module: p.module,
      action: p.action,
      label: p.label,
      isCustom: true,
    })),
  ]

  const addPermission = useCallback(
    (module: string, action: string, label: string) => {
      const key = `${module}.${action}`
      if (PERMISSIONS.some((p) => p.key === key) || custom.some((p) => p.key === key)) {
        return false
      }
      const next = [...custom, { key, module, action, label }]
      setCustom(next)
      saveCustom(next)
      return true
    },
    [custom]
  )

  const removePermission = useCallback(
    (key: string) => {
      const next = custom.filter((p) => p.key !== key)
      setCustom(next)
      saveCustom(next)
    },
    [custom]
  )

  return { allPermissions, addPermission, removePermission }
}
