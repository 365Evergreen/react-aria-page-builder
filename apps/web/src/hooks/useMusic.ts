import { useState, useEffect } from "react"

export const MEDIA_PREFIX = "https://media.paulibaby.com/"

export interface Track {
  trackNum: string
  title: string
  artist: string
  album: string
  src: string
  cover: string
}

export interface Album {
  artist: string
  album: string
  cover: string
  tracks: Track[]
}

function parseTitle(filename: string): string {
  // "01 - The Width Of A Circle.mp3" → "The Width Of A Circle"
  const base = filename.split("/").pop() ?? filename
  const withoutExt = base.replace(/\.[^.]+$/, "")
  const dashIdx = withoutExt.indexOf(" - ")
  return dashIdx >= 0 ? withoutExt.slice(dashIdx + 3).trim() : withoutExt
}

function parseAlbums(raw: unknown[]): Album[] {
  return raw.map((entry: any) => {
    const cover = MEDIA_PREFIX + entry.cover
    const songsObj: Record<string, string> = entry.songs?.[0] ?? {}
    const tracks: Track[] = Object.entries(songsObj)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([num, path]) => ({
        trackNum: num,
        title: parseTitle(path),
        artist: entry.artist,
        album: entry.album,
        src: MEDIA_PREFIX + path,
        cover,
      }))
    return { artist: entry.artist, album: entry.album, cover, tracks }
  })
}

export function useMusic() {
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/content/music.json")
      .then((r) => r.json())
      .then((raw) => setAlbums(parseAlbums(raw)))
      .catch(() => setAlbums([]))
      .finally(() => setLoading(false))
  }, [])

  return { albums, loading }
}
