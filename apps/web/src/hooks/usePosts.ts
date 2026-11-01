import { useEffect, useState } from "react"

export type PostType = "article" | "audio" | "video"

export interface Post {
  id: string
  title: string
  slug: string
  category_slug?: string | null
  excerpt: string
  cover_image: string | null
  type: PostType
  duration: string | null
  created_at: string
  categories?: {
    id: number
    name: string
    slug: string
  }[]
}

export interface PostDetail extends Post {
  content: unknown
}

export function formatDate(iso: string): string {
  const d = new Date(iso)

  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yy = String(d.getFullYear()).slice(2)

  return `${dd}/${mm}/${yy}`
}

async function fetchPosts(
  type?: PostType,
  limit = 50,
  category?: string,
  signal?: AbortSignal
): Promise<Post[]> {
  const params = new URLSearchParams()

  if (type) {
    params.set("type", type)
  }

  params.set("limit", String(limit))

  if (category) {
    params.set("category", category)
  }

  try {
    const workerRes = await fetch(`/api/posts?${params.toString()}`, {
      signal,
    })

    if (!workerRes.ok) {
      throw new Error(
        `Failed to fetch posts: ${workerRes.status} ${workerRes.statusText}`
      )
    }

    const data: unknown = await workerRes.json()

    if (!Array.isArray(data)) {
      throw new Error("Invalid posts response")
    }

    return data as Post[]
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }

    throw error instanceof Error
      ? error
      : new Error("Unable to fetch posts")
  }
}

async function fetchPost(
  slug: string,
  signal?: AbortSignal
): Promise<PostDetail | null> {
  try {
    const workerRes = await fetch(`/api/posts/${slug}`, {
      signal,
    })

    if (workerRes.status === 404) {
      return null
    }

    if (!workerRes.ok) {
      throw new Error(
        `Failed to fetch post: ${workerRes.status} ${workerRes.statusText}`
      )
    }

    const data: unknown = await workerRes.json()

    if (
      data &&
      typeof data === "object" &&
      "id" in data
    ) {
      return data as PostDetail
    }

    return null
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }

    throw error instanceof Error
      ? error
      : new Error("Unable to fetch post")
  }
}

export function usePosts(
  type?: PostType,
  limit = 50,
  category?: string
) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    fetchPosts(
      type,
      limit,
      category,
      controller.signal
    )
      .then((data) => {
        if (controller.signal.aborted) {
          return
        }

        setPosts(data)
        setError(null)
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unable to fetch posts"

        setError(message)
        setLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [type, limit, category])

  return {
    posts,
    loading,
    error,
  }
}

export function usePost(slug: string) {
  const [post, setPost] = useState<PostDetail | null>(null)
  const [loading, setLoading] = useState(Boolean(slug))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) {
      return
    }

    const controller = new AbortController()

    fetchPost(
      slug,
      controller.signal
    )
      .then((data) => {
        if (controller.signal.aborted) {
          return
        }

        setPost(data)
        setError(null)
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unable to fetch post"

        setError(message)
        setLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [slug])

  return {
    post,
    loading,
    error,
  }
}