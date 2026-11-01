import { usePosts, formatDate, type Post } from "../../hooks/usePosts";
import styles from "./FeaturedPost.module.css";

function TypeKicker({ type }: { type: Post["type"] }) {
  const labels: Record<Post["type"], string> = {
    article: "Article",
    audio: "Audio",
    video: "Video",
  };
  return (
    <span className={`${styles.kicker} ${styles[`kicker--${type}`]}`}>
      {labels[type]}
    </span>
  );
}

function FeaturedSkeleton() {
  return <div className={styles.skeleton} aria-hidden />;
}

export default function FeaturedPost() {
  const { posts, loading } = usePosts();

  if (loading) return <FeaturedSkeleton />;

  // Pick the most recent post with a cover image, or first post overall
  const post = posts.find((p) => p.cover_image) ?? posts[0];
  if (!post) return null;

  return (
    <section className={styles.section}>
      {/* Section label */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>Featured</span>
      </div>

      <article className={styles.feature}>
        {/* Image — left column */}
        {post.cover_image && (
          <a
            href={`/posts/${post.slug}`}
            className={styles.imageLink}
            tabIndex={-1}
            aria-hidden
          >
            <div className={styles.imageWrap}>
              <img
                src={post.cover_image}
                alt={post.title}
                className={styles.image}
                loading="eager"
              />
            </div>
          </a>
        )}

        {/* Text — right column */}
        <div className={styles.body}>
          <div className={styles.meta}>
            <TypeKicker type={post.type} />
            <time className={styles.date}>{formatDate(post.created_at)}</time>
          </div>

          <h2 className={styles.headline}>
            <a href={`/posts/${post.slug}`} className={styles.headlineLink}>
              {post.title}
            </a>
          </h2>

          {post.excerpt && <p className={styles.lede}>{post.excerpt}</p>}

          <a href={`/posts/${post.slug}`} className={styles.cta}>
            {post.type === "audio"
              ? "Listen"
              : post.type === "video"
                ? "Watch"
                : "Read"}{" "}
            the full {post.type} →
          </a>
        </div>
      </article>
    </section>
  );
}
