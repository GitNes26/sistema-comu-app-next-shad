"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Megaphone, Newspaper, Pin, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusPill } from "@/components/base/status-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { PostFlyer } from "@/components/portal/post-flyer"
import { apiJson, errorMessage } from "@/lib/ministries/client"
import { POST_KINDS } from "@/lib/portal/rules"
import type { PostDto } from "@/lib/portal/server"

// Publicaciones de la iglesia: anuncios, devocionales, artículos y noticias.

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

/** Texto con saltos de línea y enlaces https clicables (sin HTML). */
function Body({ text }: { text: string }) {
  const parts = text.split(/(https:\/\/[^\s]+)/g)
  return (
    <p className="text-sm leading-relaxed whitespace-pre-line">
      {parts.map((p, i) =>
        p.startsWith("https://") ? (
          <a
            key={i}
            href={p}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline-offset-2 hover:underline"
          >
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </p>
  )
}

export function ContentFeed({ canManage }: { canManage: boolean }) {
  const [posts, setPosts] = useState<PostDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiJson<{ posts: PostDto[] }>("/api/portal/posts")
      .then((r) => setPosts(r.posts))
      .catch((e) =>
        setError(errorMessage(e, "No se pudieron cargar las publicaciones"))
      )
  }, [])

  if (error)
    return (
      <EmptyState
        icon={Newspaper}
        title="No se pudo cargar"
        description={error}
      />
    )
  if (!posts) return <Skeleton className="h-64 w-full" />

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/content">
              <Settings2 className="size-4" />
              Administrar contenido
            </Link>
          </Button>
        </div>
      )}
      {posts.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Aún no hay publicaciones"
          description="Cuando la iglesia publique anuncios o devocionales, aparecerán aquí."
        />
      ) : (
        <ul className="space-y-4">
          {posts.map((p) => (
            <li key={p.id} id={p.id}>
              <article className="overflow-hidden rounded-2xl border bg-card">
                {p.flyer ? (
                  <div className="p-3 pb-0 sm:mx-auto sm:max-w-md">
                    <PostFlyer
                      flyer={p.flyer}
                      title={p.title}
                      body={p.body}
                      kind={p.kind}
                    />
                  </div>
                ) : (
                  p.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.coverUrl}
                      alt=""
                      loading="lazy"
                      className="aspect-[16/7] w-full object-cover"
                    />
                  )
                )}
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone="info" dot={false}>
                      {POST_KINDS[p.kind]}
                    </StatusPill>
                    {p.pinned && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Pin className="size-3" />
                        Fijada
                      </span>
                    )}
                    <time
                      className="ml-auto text-xs text-muted-foreground"
                      dateTime={p.publishedAt}
                    >
                      {fmt(p.publishedAt)}
                    </time>
                  </div>
                  <h2 className="font-heading text-lg font-semibold">
                    {p.title}
                  </h2>
                  <Body text={p.body} />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
