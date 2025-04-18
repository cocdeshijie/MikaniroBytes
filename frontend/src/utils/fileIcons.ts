/**
 * Central mapping: file extension ⇒ React‑Icon component.
 * Extend here whenever you support new types or switch to thumbnails.
 */

import {
  FiFile as Fallback,
  FiImage,
  FiVideo,
  FiMusic,
  FiFileText,
  FiArchive,
  FiCode,
} from "react-icons/fi";

type IconCmp = React.ComponentType<{ className?: string }>;

function ext(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}

const map: Record<string, IconCmp> = {
  // images
  jpg: FiImage,
  jpeg: FiImage,
  png: FiImage,
  gif: FiImage,
  webp: FiImage,
  svg: FiImage,
  // video
  mp4: FiVideo,
  mov: FiVideo,
  webm: FiVideo,
  // audio
  mp3: FiMusic,
  wav: FiMusic,
  flac: FiMusic,
  // code / text
  txt: FiFileText,
  md: FiFileText,
  json: FiCode,
  js: FiCode,
  ts: FiCode,
  py: FiCode,
  html: FiCode,
  css: FiCode,
  // archives
  zip: FiArchive,
  rar: FiArchive,
  "7z": FiArchive,
  tar: FiArchive,
};

export function iconFor(filename: string): IconCmp {
  return map[ext(filename)] ?? Fallback;
}
