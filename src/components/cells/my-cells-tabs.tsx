"use client"

import { useState } from "react"
import { Home, Search } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CellsList } from "@/components/cells/cells-list"
import { CellFinder } from "@/components/cells/cell-finder"

/** «Mi hogar de amor»: el hogar donde participo y, en la otra pestaña, el buscador. */
export function MyCellsTabs({ initial }: { initial: "mine" | "find" }) {
  const [tab, setTab] = useState(initial)
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "mine" | "find")}>
      <TabsList>
        <TabsTrigger value="mine">
          <Home className="size-4" /> Mi hogar
        </TabsTrigger>
        <TabsTrigger value="find">
          <Search className="size-4" /> Buscar un hogar
        </TabsTrigger>
      </TabsList>
      <TabsContent value="mine" className="pt-3">
        <CellsList scope="mine" basePath="/mi/celulas" />
      </TabsContent>
      <TabsContent value="find" className="pt-3">
        <CellFinder mode={{ kind: "portal" }} />
      </TabsContent>
    </Tabs>
  )
}
