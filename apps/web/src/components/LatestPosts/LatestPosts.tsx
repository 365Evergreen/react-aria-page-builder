import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  usePosts,
  formatDate,
  type Post,
} from "../../hooks/usePosts"
import styles from "./LatestPosts.module.css"

export default function LatestPosts() {
  const navigate = useNavigate()

  /*
   * Fetch six posts because one may be the featured post.
   * After excluding it, we still want up to five posts
   * available for the Latest layout.
   */
  const { posts, loading, error } = usePosts(undefined, 6)

  const [failedImages, setFailedImages] = useState<Set<string>>(
    () => new Set()
  )

  /*
   * Determine the featured post using the same logic as FeaturedPost:
   * - Most recent post with a cover image, or
   * - First post overall if none has a cover image
   */
  const featuredPostId = useMemo(() => {
    const featured = posts.find((p) => p.cover_image) ?? posts[0]
    return featured?.id
  }, [posts])

  /*
   * Remove the featured post before constructing the
   * five-post Latest layout.
   */
  const latestPosts = posts
    .filter((post) => post.id !== featuredPostId)
    .slice(0, 5)

  const handleNavigate = (post: Post) => {
    navigate(`/posts/${post.slug}`)
  }

  const handleViewAll = () => {
    navigate("/archive")
  }

  const handleImageError = (postId: string) => {
    setFailedImages((current) => {
      const next = new Set(current)
      next.add(postId)
      return next
    })
  }

  const getCategoryName = (post: Post): string => {
    if (post.categories && post.categories.length > 0) {
      return post.categories[0].name
    }

    if (post.category_slug) {
      return post.category_slug.replace(/-/g, " ")
    }

    return post.type
  }

  const getCategorySlug = (post: Post): string => {
    if (post.category_slug) {
      return post.category_slug
    }

    if (post.categories && post.categories.length > 0) {
      return post.categories[0].slug
    }

    return post.type ?? "article"
  }

  const getCategoryClass = (post: Post): string => {
    const slug = getCategorySlug(post).toLowerCase()

    switch (slug) {
      case "music":
        return styles.categoryMusic

      case "radio":
      case "radio-and-podcasts":
      case "podcasts":
        return styles.categoryRadio

      case "documentary":
      case "documentaries":
        return styles.categoryDocumentary

      case "comedy":
        return styles.categoryComedy

      case "video":
        return styles.categoryVideo

      default:
        return styles.categoryDefault
    }
  }

  const getMediaLabel = (post: Post): string | null => {
    switch (post.type) {
      case "audio":
        return "Listen"

      case "video":
        return "Watch"

      default:
        return null
    }
  }

  const renderImage = (post: Post, isLead: boolean) => {
    const hasImage =
      Boolean(post.cover_image) && !failedImages.has(post.id)

    const mediaLabel = getMediaLabel(post)

    return (
      <div className={styles.imageWrapper}>
        {hasImage ? (
          <img
            src={post.cover_image ?? ""}
            alt=""
            className={styles.image}
            loading={isLead ? "eager" : "lazy"}
            onError={() => handleImageError(post.id)}
          />
        ) : (
          <div className={styles.imagePlaceholder}>
            <span>{getCategoryName(post)}</span>
          </div>
        )}

        {mediaLabel && (
          <span className={styles.mediaType}>
            {mediaLabel}
          </span>
        )}
      </div>
    )
  }

  const renderPost = (post: Post, index: number) => {
    const isLead = index === 0
    const isSecondary = index === 1

    const cardClasses = [
      styles.card,
      isLead ? styles.leadCard : "",
      isSecondary ? styles.secondaryCard : "",
    ]
      .filter(Boolean)
      .join(" ")

    const categoryClasses = [
      styles.category,
      getCategoryClass(post),
    ]
      .filter(Boolean)
      .join(" ")

    return (
      <article
        key={post.id}
        className={cardClasses}
      >
        <button
          type="button"
          className={styles.imageButton}
          onClick={() => handleNavigate(post)}
          aria-label={`Read ${post.title}`}
        >
          {renderImage(post, isLead)}
        </button>

        <div className={styles.content}>
          <div className={styles.meta}>
            <span className={categoryClasses}>
              {getCategoryName(post)}
            </span>

            {post.duration && (
              <span className={styles.readingTime}>
                {post.duration}
              </span>
            )}
          </div>

          <h3 className={styles.title}>
            <button
              type="button"
              className={styles.titleButton}
              onClick={() => handleNavigate(post)}
            >
              {post.title}
            </button>
          </h3>

          {(isLead || isSecondary) && post.excerpt && (
            <p className={styles.excerpt}>
              {post.excerpt}
            </p>
          )}

          {isLead ? (
            <button
              type="button"
              className={styles.readStory}
              onClick={() => handleNavigate(post)}
            >
              Read story
              <span aria-hidden="true">→</span>
            </button>
          ) : (
            <div className={styles.date}>
              {formatDate(post.created_at)}
            </div>
          )}
        </div>
      </article>
    )
  }

  if (loading) {
    return (
      <section
        className={styles.section}
        aria-labelledby="latest-posts-heading"
      >
        <div className={styles.header}>
          <h2
            id="latest-posts-heading"
            className={styles.heading}
          >
            Latest
          </h2>
        </div>

        <div className={styles.loading}>
          Loading latest posts…
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section
        className={styles.section}
        aria-labelledby="latest-posts-heading"
      >
        <div className={styles.header}>
          <h2
            id="latest-posts-heading"
            className={styles.heading}
          >
            Latest
          </h2>
        </div>

        <div className={styles.error}>
          Unable to load the latest posts.
        </div>
      </section>
    )
  }

  if (latestPosts.length === 0) {
    return null
  }

  return (
    <section
      className={styles.section}
      aria-labelledby="latest-posts-heading"
    >
      <div className={styles.header}>
        <h2
          id="latest-posts-heading"
          className={styles.heading}
        >
          Latest
        </h2>

        <button
          type="button"
          className={styles.viewAll}
          onClick={handleViewAll}
        >
          View all posts
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className={styles.grid}>
        {latestPosts.map((post, index) =>
          renderPost(post, index)
        )}
      </div>
    </section>
  )
}