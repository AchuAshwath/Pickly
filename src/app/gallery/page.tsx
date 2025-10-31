"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { FolderOpen, Copy, Check, ImageOff, Flag, X as XIcon, Star, HelpCircle, SlidersHorizontal, CopyCheck } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

import InfiniteScroll from "react-infinite-scroll-component";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";

interface PhotoMetadata {
  name: string;
  relativePath: string;
  fileHandle: File;
}

interface DisplayPhoto extends PhotoMetadata {
  objectUrl: string;
}

const allowedImageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const PHOTOS_PER_PAGE = 50;

export default function GalleryPage() {
  const [selectedFolderName, setSelectedFolderName] = useState<string | null>(null);
  const [allPhotos, setAllPhotos] = useState<PhotoMetadata[]>([]);
  const [visiblePhotos, setVisiblePhotos] = useState<DisplayPhoto[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [highlightedPhotos, setHighlightedPhotos] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [viewerIndex, setViewerIndex] = useState(-1);
  const [lightboxSlides, setLightboxSlides] = useState<
    Array<{ src: string; alt?: string; title?: string }>
  >([]);
  const lightboxObjectUrlsRef = useRef<string[]>([]);

  const [photoDimensionsByPath, setPhotoDimensionsByPath] = useState<Record<string, { width: number; height: number }>>({});
  const [exifByPath, setExifByPath] = useState<Record<string, Partial<Record<string, unknown>>>>({});

  // Ratings and Flags state
  type FlagState = "none" | "pick" | "reject";
  const [ratingsByKey, setRatingsByKey] = useState<Record<string, number>>({});
  const [flagsByKey, setFlagsByKey] = useState<Record<string, FlagState>>({});
  const [lastActiveKey, setLastActiveKey] = useState<string | null>(null);
  const [minRatingFilter, setMinRatingFilter] = useState<number>(0);
  const [flagFilter, setFlagFilter] = useState<"all" | "pick" | "reject" | "unflagged">("all");
  const [showFilters, setShowFilters] = useState<boolean>(true);

  // Compare state
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareUrls, setCompareUrls] = useState<string[]>([]);
  const [compareNames, setCompareNames] = useState<string[]>([]);
  const [compareZoomScales, setCompareZoomScales] = useState<[number, number]>([1, 1]);
  const [compareOffsets, setCompareOffsets] = useState<[{ x: number; y: number }, { x: number; y: number }]>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);
  const comparePanningRef = useRef<[boolean, boolean]>([false, false]);
  const compareLastPosRef = useRef<[{ x: number; y: number }, { x: number; y: number }]>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);

  // Persistent folder handle presence
  const [hasPersistedFolder, setHasPersistedFolder] = useState(false);
  // Viewer stats dropdown
  const [showStats, setShowStats] = useState<boolean>(false);
  // Zoom/pan state for custom viewer
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Recent folders
  const [recentDirs, setRecentDirs] = useState<Array<{ name: string }>>([]);

  // Download helpers for viewer
  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const downloadCurrent = useCallback(async (preset: "original" | "4k" | "large" | "medium" | "small" | "webp-1080") => {
    if (viewerIndex < 0) return;
    const photo = allPhotos[viewerIndex];
    if (!photo) return;
    try {
      if (preset === "original") {
        downloadBlob(photo.fileHandle, photo.name);
        return;
      }
      const objectUrl = lightboxObjectUrlsRef.current[viewerIndex];
      if (!objectUrl) return;
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = objectUrl;
      });
      let maxW = 1920;
      if (preset === "4k") maxW = 3840;
      else if (preset === "large") maxW = 2560;
      else if (preset === "medium") maxW = 1920;
      else if (preset === "small") maxW = 1280;
      const scale = Math.min(1, maxW / img.naturalWidth);
      const targetW = Math.round(img.naturalWidth * scale);
      const targetH = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, targetW, targetH);
      await new Promise<void>((resolve) => {
        const isWebp = preset === "webp-1080";
        const mime = isWebp ? "image/webp" : "image/jpeg";
        const ext = isWebp ? "webp" : "jpg";
        const quality = isWebp ? 0.85 : 0.9;
        canvas.toBlob((blob) => {
          if (blob) downloadBlob(blob, `${photo.name.replace(/\.[^.]+$/, "")}__${preset}.${ext}`);
          resolve();
        }, mime, quality);
      });
    } catch (e) {
      console.error("Download failed", e);
      toast.error("Download failed", { description: String(e) });
    }
  }, [viewerIndex, allPhotos, downloadBlob, toast]);

  const formatFileSize = useCallback((bytes: number) => {
    if (!Number.isFinite(bytes)) return "-";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const visibleObjectUrlsRef = useRef<Set<string>>(new Set());

  const revokeUrls = useCallback((urlsToRevoke: Iterable<string>) => {
    for (const url of urlsToRevoke) {
      URL.revokeObjectURL(url);
    }
  }, []);

  const revokePreviousVisibleUrls = useCallback(() => {
    revokeUrls(visibleObjectUrlsRef.current);
    visibleObjectUrlsRef.current.clear();
  }, [revokeUrls]);

  const revokeLightboxUrls = useCallback(() => {
    revokeUrls(lightboxObjectUrlsRef.current);
    lightboxObjectUrlsRef.current = [];
  }, [revokeUrls]);

  useEffect(() => {
    return () => {
      revokePreviousVisibleUrls();
      revokeLightboxUrls();
    };
  }, [revokePreviousVisibleUrls, revokeLightboxUrls]);

  const handleFolderSelectClick = () => {
    fileInputRef.current?.click();
  };

  // --- IndexedDB helpers for persisting a folder handle ---
  const idbOpen = useCallback(async () => {
    return await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("lps", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }, []);

  const idbSet = useCallback(async (key: string, value: unknown) => {
    const db = await idbOpen();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      const store = tx.objectStore("kv");
      const req = store.put(value as unknown as IDBValidKey, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }, [idbOpen]);

  const idbGet = useCallback(async <T,>(key: string): Promise<T | undefined> => {
    const db = await idbOpen();
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction("kv", "readonly");
      const store = tx.objectStore("kv");
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  }, [idbOpen]);

  // Check for persisted handle on mount
  useEffect(() => {
    (async () => {
      try {
        if (!("showDirectoryPicker" in window) || !indexedDB) return;
        const handle = await idbGet<any>("dirHandle");
        setHasPersistedFolder(!!handle);
        const recent = (await idbGet<any>("recentDirs")) || [];
        if (Array.isArray(recent)) setRecentDirs(recent.map((r: any) => ({ name: r?.name || "(unknown)" })));
      } catch {
        // ignore
      }
    })();
  }, [idbGet]);

  // Maintain a capped recent list of directory handles in IDB
  const addToRecent = useCallback(async (dirHandle: any) => {
    try {
      const MAX_RECENT = 5;
      const existing = (await idbGet<any>("recentDirs")) || [];
      const name = dirHandle?.name || "(Folder)";
      // Dedup by name (best-effort; FS handles are not reliably comparable)
      const filtered = existing.filter((e: any) => e?.name !== name);
      const next = [{ name, handle: dirHandle, ts: Date.now() }, ...filtered].slice(0, MAX_RECENT);
      await idbSet("recentDirs", next);
      setRecentDirs(next.map((r: any) => ({ name: r.name })));
    } catch {
      // ignore
    }
  }, [idbGet, idbSet]);

  // Load from a File System directory handle
  const loadFromDirectoryHandle = useCallback(async (dirHandle: any) => {
    revokePreviousVisibleUrls();
    revokeLightboxUrls();
    setAllPhotos([]);
    setVisiblePhotos([]);
    setSelectedPhotos(new Set());
    setSelectedFolderName(null);
    setError(null);
    setViewerIndex(-1);
    setHasMore(false);

    try {
      // Request read permission if needed
      if (dirHandle.requestPermission) {
        const perm = await dirHandle.requestPermission({ mode: "read" });
        if (perm !== "granted") throw new Error("Permission denied");
      }

      setIsLoading(true);
      const localPhotoMetadata: PhotoMetadata[] = [];

      const walk = async (directoryHandle: any, prefix: string = "") => {
        for await (const [name, handle] of directoryHandle.entries()) {
          if (handle.kind === "file") {
            const file: File = await handle.getFile();
            const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
            if (allowedImageExtensions.includes(extension) && file.type.startsWith("image/")) {
              localPhotoMetadata.push({
                name: file.name,
                relativePath: `${prefix}${name}`,
                fileHandle: file,
              });
            }
          } else if (handle.kind === "directory") {
            await walk(handle, `${prefix}${name}/`);
          }
        }
      };

      await walk(dirHandle, "");
      if (localPhotoMetadata.length === 0) {
        setError("No supported image files found in the selected directory.");
        throw new Error("No supported images found.");
      }

      setSelectedFolderName("Selected Folder");
      localPhotoMetadata.sort((a, b) => a.name.localeCompare(b.name));
      setAllPhotos(localPhotoMetadata);
      setHasMore(localPhotoMetadata.length > PHOTOS_PER_PAGE);
      loadMorePhotos(localPhotoMetadata, []);
    } catch (err: unknown) {
      console.error("Error loading directory:", err);
      setError((err as Error)?.message || "Could not open folder");
    } finally {
      setIsLoading(false);
    }
  }, [revokePreviousVisibleUrls, revokeLightboxUrls, loadMorePhotos]);

  const handlePickPersistentFolder = useCallback(async () => {
    try {
      // @ts-expect-error File System Access API
      if (!window.showDirectoryPicker) throw new Error("Not supported by this browser");
      // @ts-expect-error
      const dirHandle = await window.showDirectoryPicker({ mode: "read" });
      await idbSet("dirHandle", dirHandle);
      setHasPersistedFolder(true);
      await addToRecent(dirHandle);
      await loadFromDirectoryHandle(dirHandle);
    } catch (e) {
      console.warn("Persistent folder pick cancelled or failed", e);
    }
  }, [idbSet, loadFromDirectoryHandle, addToRecent]);

  const handleRestorePersistentFolder = useCallback(async () => {
    try {
      const handle = await idbGet<any>("dirHandle");
      if (!handle) return;
      await addToRecent(handle);
      await loadFromDirectoryHandle(handle);
    } catch (e) {
      console.warn("Restore failed", e);
    }
  }, [idbGet, loadFromDirectoryHandle, addToRecent]);

  // Hoisted function to avoid temporal dead zone issues in deps
  function loadMorePhotos(
    currentAllPhotos: PhotoMetadata[] = allPhotos,
    currentVisiblePhotos: DisplayPhoto[] = visiblePhotos
  ) {
    const startIndex = currentVisiblePhotos.length;
    const endIndex = Math.min(startIndex + PHOTOS_PER_PAGE, currentAllPhotos.length);
    if (startIndex >= currentAllPhotos.length) {
      setHasMore(false);
      return;
    }
    const nextBatchMetadata = currentAllPhotos.slice(startIndex, endIndex);
    const newVisiblePhotos: DisplayPhoto[] = [];
    for (const meta of nextBatchMetadata) {
      try {
        const objectUrl = URL.createObjectURL(meta.fileHandle);
        visibleObjectUrlsRef.current.add(objectUrl);
        newVisiblePhotos.push({ ...meta, objectUrl });
      } catch (urlError) {
        console.error(`Failed to create Object URL for ${meta.name}:`, urlError);
      }
    }
    setVisiblePhotos((prev) => [...prev, ...newVisiblePhotos]);
    setHasMore(endIndex < currentAllPhotos.length);
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    revokePreviousVisibleUrls();
    revokeLightboxUrls();
    setAllPhotos([]);
    setVisiblePhotos([]);
    setSelectedPhotos(new Set());
    setSelectedFolderName(null);
    setError(null);
    setViewerIndex(-1);
    setHasMore(false);

    const files = event.target.files;
    if (!files || files.length === 0) {
      if (event.target) event.target.value = "";
      return;
    }

    setIsLoading(true);
    const localPhotoMetadata: PhotoMetadata[] = [];

    try {
      console.time("File Processing");
      const photoFiles: File[] = Array.from(files).filter((file) => {
        const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
        return (
          allowedImageExtensions.includes(extension) &&
          file.type.startsWith("image/")
        );
      });

      if (photoFiles.length === 0) {
        setError("No supported image files found in the selected directory.");
        throw new Error("No supported images found.");
      }

      const commonPath = photoFiles[0]?.webkitRelativePath || "Selected Folder";
      const firstSlashIndex = commonPath.indexOf("/");
      const dirName =
        firstSlashIndex > 0
          ? commonPath.substring(0, firstSlashIndex)
          : commonPath.split("/")[0] || "Selected Folder";
      setSelectedFolderName(dirName);

      for (const file of photoFiles) {
        localPhotoMetadata.push({
          name: file.name,
          relativePath: file.webkitRelativePath,
          fileHandle: file,
        });
      }
      localPhotoMetadata.sort((a, b) => a.name.localeCompare(b.name));
      console.timeEnd("File Processing");

      setAllPhotos(localPhotoMetadata);
      setHasMore(localPhotoMetadata.length > PHOTOS_PER_PAGE);

      console.time("First Batch Load");
      loadMorePhotos(localPhotoMetadata, []);
      console.timeEnd("First Batch Load");
    } catch (err: unknown) {
      console.error("Error processing files:", err);
      setError(`Error processing files: ${(err as Error)?.message || "Unknown error"}`);
      toast.error("Error processing files", {
        description:
          (err as Error)?.message || "Could not load photos from the selected folder.",
      });
      setAllPhotos([]);
      setVisiblePhotos([]);
      setSelectedFolderName(null);
      visibleObjectUrlsRef.current.clear();
    } finally {
      setIsLoading(false);
      if (event.target) event.target.value = "";
    }
  };

  

  const handlePhotoHighlightToggle = useCallback((photoName: string) => {
    setHighlightedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(photoName)) next.delete(photoName);
      else next.add(photoName);
      return next;
    });
  }, []);

  const handlePhotoSelectToggle = useCallback((photoName: string) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(photoName)) next.delete(photoName);
      else next.add(photoName);
      return next;
    });
  }, []);

  const handleViewPhotoRequest = useCallback(
    (requestedIndex: number) => {
      if (requestedIndex < 0 || requestedIndex >= allPhotos.length) return;

      console.time("Lightbox URL Generation");
      revokeLightboxUrls();
      const newLightboxUrls: string[] = [];
      const slidesData = allPhotos.map((photo) => {
        try {
          const url = URL.createObjectURL(photo.fileHandle);
          newLightboxUrls.push(url);
          return {
            src: url,
            alt: photo.name,
            title: photo.name,
          };
        } catch (e) {
          console.error(
            `Failed to create Object URL for lightbox slide ${photo.name}:`,
            e
          );
          return {
            src: "",
            alt: `Error loading ${photo.name}`,
            title: photo.name,
          };
        }
      });
      console.timeEnd("Lightbox URL Generation");

      lightboxObjectUrlsRef.current = newLightboxUrls;
      setLightboxSlides(slidesData);
      setViewerIndex(requestedIndex);
      const p = allPhotos[requestedIndex];
      if (p) setLastActiveKey(p.relativePath || p.name);
    },
    [allPhotos, revokeLightboxUrls]
  );

  const handleCloseLightbox = () => {
    setViewerIndex(-1);
    revokeLightboxUrls();
    setLightboxSlides([]);
  };

  useEffect(() => {
    if (viewerIndex < 0) return;
    const photo = allPhotos[viewerIndex];
    if (!photo) return;
    const key = photo.relativePath || photo.name;
    if (photoDimensionsByPath[key]) return;

    const url = lightboxObjectUrlsRef.current[viewerIndex];
    if (!url) return;

    try {
      const img = new window.Image();
      img.onload = () => {
        setPhotoDimensionsByPath((prev) => ({
          ...prev,
          [key]: { width: img.naturalWidth, height: img.naturalHeight },
        }));
      };
      img.onerror = () => {};
      img.src = url;
    } catch {
      // ignore
    }
  }, [viewerIndex, allPhotos, photoDimensionsByPath]);

  // Lazy parse EXIF for current viewer photo (dynamic import to avoid hard dep)
  useEffect(() => {
    (async () => {
      if (viewerIndex < 0) return;
      const photo = allPhotos[viewerIndex];
      if (!photo) return;
      const key = photo.relativePath || photo.name;
      if (exifByPath[key]) return;
      try {
        // Dynamically import exifr only in the browser when needed
        const mod = await import("exifr").catch(() => null as any);
        if (!mod?.default?.parse) return;
        const data = await mod.default.parse(photo.fileHandle).catch(() => undefined);
        if (data) {
          setExifByPath((prev) => ({ ...prev, [key]: data as Record<string, unknown> }));
        }
      } catch {
        // ignore
      }
    })();
  }, [viewerIndex, allPhotos, exifByPath]);

  const handleCopyToClipboard = async () => {
    if (selectedPhotos.size === 0) return;
    setIsCopying(true);

    const orderedSelectedNames = allPhotos
      .filter((p) => selectedPhotos.has(p.name))
      .map((p) => p.name);

    const textToCopy = orderedSelectedNames
      .map((name, index) => `${index + 1}. ${name}`)
      .join("\n");

    if (!navigator.clipboard) {
      toast.error("Copy Failed", {
        description:
          "Clipboard access requires a secure connection (HTTPS) or is not supported by your browser.",
        duration: 4000,
      });
      setIsCopying(false);
      return;
    }
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success("Copied to clipboard!", {
        description: `${orderedSelectedNames.length} photo name${
          orderedSelectedNames.length === 1 ? "" : "s"
        } copied.`,
        duration: 2000,
      });
      setTimeout(() => setIsCopying(false), 1500);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      toast.error("Copy Failed", {
        description: "Could not write to clipboard. Check browser permissions.",
      });
      setIsCopying(false);
    }
  };

  const selectedPhotoList = React.useMemo(() => {
    return allPhotos
      .filter((p) => selectedPhotos.has(p.name))
      .map((p) => p.name);
  }, [allPhotos, selectedPhotos]);

  // Keyboard shortcuts for rating/flagging
  useEffect(() => {
    const applyToKey = (key: string | null) => key;
    const handler = (e: KeyboardEvent) => {
      // ignore when in input/textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      // Determine active photo key (prefer viewer photo)
      const currentKey = (() => {
        if (viewerIndex >= 0 && allPhotos[viewerIndex]) {
          const p = allPhotos[viewerIndex];
          return p.relativePath || p.name;
        }
        return applyToKey(lastActiveKey);
      })();
      if (!currentKey) return;

      // Rating 0-5
      if (e.key >= "0" && e.key <= "5") {
        e.preventDefault();
        const value = parseInt(e.key, 10);
        setRatingsByKey((prev) => ({ ...prev, [currentKey]: value }));
        return;
      }
      // Pick/Reject/Untag
      if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        setFlagsByKey((prev) => ({ ...prev, [currentKey]: "pick" }));
        return;
      }
      if (e.key.toLowerCase() === "x") {
        e.preventDefault();
        setFlagsByKey((prev) => ({ ...prev, [currentKey]: "reject" }));
        return;
      }
      if (e.key.toLowerCase() === "u") {
        e.preventDefault();
        setFlagsByKey((prev) => ({ ...prev, [currentKey]: "none" }));
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewerIndex, allPhotos, lastActiveKey]);

  // Quick actions for active photo
  const activeKey = React.useMemo(() => {
    if (viewerIndex >= 0 && allPhotos[viewerIndex]) {
      const p = allPhotos[viewerIndex];
      return p.relativePath || p.name;
    }
    return lastActiveKey;
  }, [viewerIndex, allPhotos, lastActiveKey]);

  const setActiveRating = (value: number) => {
    if (highlightedPhotos.size === 0) return;
    const next: Record<string, number> = {};
    for (const name of highlightedPhotos) {
      const match = allPhotos.find((p) => p.name === name);
      const key = match?.relativePath || match?.name;
      if (key) next[key] = value;
    }
    setRatingsByKey((prev) => ({ ...prev, ...next }));
  };
  const setActiveFlag = (value: FlagState) => {
    if (highlightedPhotos.size === 0) return;
    const next: Record<string, FlagState> = {};
    for (const name of highlightedPhotos) {
      const match = allPhotos.find((p) => p.name === name);
      const key = match?.relativePath || match?.name;
      if (key) next[key] = value;
    }
    setFlagsByKey((prev) => ({ ...prev, ...next }));
  };

  // Open compare dialog for exactly two selected items
  const openCompareIfTwoSelected = () => {
    if (selectedPhotos.size !== 2) return;
    const names = allPhotos.filter((p) => selectedPhotos.has(p.name));
    const urls: string[] = [];
    const displayNames: string[] = [];
    for (const p of names) {
      try {
        const url = URL.createObjectURL(p.fileHandle);
        urls.push(url);
        displayNames.push(p.name);
      } catch {}
    }
    setCompareUrls(urls);
    setCompareNames(displayNames);
    setIsCompareOpen(true);
  };

  const closeCompare = () => {
    setIsCompareOpen(false);
    for (const u of compareUrls) URL.revokeObjectURL(u);
    setCompareUrls([]);
    setCompareNames([]);
    setCompareZoomScales([1, 1]);
    setCompareOffsets([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  };

  // Persist UI state (filters, ratings, flags)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lps:ui");
      if (saved) {
        const parsed = JSON.parse(saved) as {
          minRating?: number;
          flagFilter?: typeof flagFilter;
          showFilters?: boolean;
          ratingsByKey?: Record<string, number>;
          flagsByKey?: Record<string, FlagState>;
        };
        if (typeof parsed.minRating === "number") setMinRatingFilter(parsed.minRating);
        if (parsed.flagFilter) setFlagFilter(parsed.flagFilter);
        if (typeof parsed.showFilters === "boolean") setShowFilters(parsed.showFilters);
        if (parsed.ratingsByKey) setRatingsByKey(parsed.ratingsByKey);
        if (parsed.flagsByKey) setFlagsByKey(parsed.flagsByKey);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const payload = JSON.stringify({
        minRating: minRatingFilter,
        flagFilter,
        showFilters,
        ratingsByKey,
        flagsByKey,
      });
      localStorage.setItem("lps:ui", payload);
    } catch {}
  }, [minRatingFilter, flagFilter, showFilters, ratingsByKey, flagsByKey]);

  return (
    <>
      <Toaster richColors position="top-center" />

      <div className="container mx-auto p-4 md:p-5 space-y-4">
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-4 md:-mx-5 px-4 md:px-5 py-2 flex flex-wrap items-center justify-between gap-2">

          {/* Split button group: main action + caret, styled like example */}
          <div className="ml-2 flex items-center gap-2 flex-wrap">
            {/* Restore icon-only button moved to the left */}
            <Button
              variant="outline"
              size="sm"
              className="p-2 h-9 w-9"
              title="Restore last folder"
              disabled={!hasPersistedFolder}
              onClick={handleRestorePersistentFolder}
            >
              ←
            </Button>
            <div className="group/buttons relative flex items-stretch rounded-md overflow-hidden border bg-primary text-primary-foreground">
              <div data-slot="popover-anchor"></div>
              <Button
                size="sm"
                variant="default"
                onClick={handleFolderSelectClick}
                disabled={isLoading}
                title="Browse a local folder"
                className="gap-1.5 px-3 has-[>svg]:px-2.5 h-9 shadow-none rounded-none"
              >
                <FolderOpen />
                {isLoading ? "Processing..." : "Choose Folder"}
              </Button>
              {/* vertical separator between main and caret */}
              <div aria-hidden className="bg-primary-foreground/25 w-px" />
              {/* caret (desktop) */}
              <Select
              onValueChange={async (value) => {
                if (value === "persistent") {
                  await handlePickPersistentFolder();
                  return;
                }
                if (value.startsWith("recent:")) {
                  const idx = Number(value.split(":")[1]);
                  try {
                    const list = (await idbGet<any>("recentDirs")) || [];
                    const chosen = list[idx];
                    if (chosen?.handle) await loadFromDirectoryHandle(chosen.handle);
                  } catch {}
                }
              }}
            >
                <SelectTrigger
                  size="sm"
                  className="items-center justify-center hidden sm:flex peer h-9 w-9 shadow-none border-0 rounded-none bg-primary text-primary-foreground"
                  title="More options"
                />
                <SelectContent>
                  <div className="px-2 py-1 text-xs text-muted-foreground">Options</div>
                  <SelectItem value="persistent">Use persistent folder</SelectItem>
                  <div className="px-2 py-1 text-xs text-muted-foreground">Recent</div>
                  {recentDirs.length ? (
                    recentDirs.map((d, i) => (
                      <SelectItem value={`recent:${i}`} key={`${d.name}-${i}`}>
                        {d.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="recent:-1" disabled>No recent folders</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: "none" }}
            directory=""
            webkitdirectory=""
            multiple
            accept="image/png, image/jpeg, image/gif, image/webp"
          />
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          {/* Toolbar */}
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="h-9" onClick={() => setShowFilters((s) => !s)}>
              <SlidersHorizontal className="h-4 w-4 mr-1" /> {showFilters ? "Hide" : "Show"} Filters
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                  <HelpCircle className="h-4 w-4 mr-1" /> Shortcuts
                </Button>
              </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                  <DialogTitle>Keyboard Shortcuts</DialogTitle>
                  <DialogDescription>Speed up your culling.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Rate</div><div>0–5</div>
                  <div className="text-muted-foreground">Pick</div><div>P</div>
                  <div className="text-muted-foreground">Reject</div><div>X</div>
                  <div className="text-muted-foreground">Clear Flag</div><div>U</div>
                  <div className="text-muted-foreground">Open Viewer</div><div>Double‑click</div>
                  <div className="text-muted-foreground">Select/Deselect</div><div>Click</div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="default"
              size="sm"
              className="h-9"
              disabled={selectedPhotos.size !== 2}
              onClick={openCompareIfTwoSelected}
              title={selectedPhotos.size === 2 ? "Compare selected" : "Select exactly 2 photos to compare"}
            >
              <CopyCheck className="h-4 w-4 mr-1" /> Compare {selectedPhotos.size === 2 ? "2" : ""}
            </Button>
            {/* Selected list formatted textarea + copy */}
            <textarea
              readOnly
              title="You can copy the list of selected photos"
              className="w-[240px] md:w-[320px] h-9 rounded-md border px-2 py-1 text-xs font-mono bg-background whitespace-pre overflow-auto resize-none"
              value={selectedPhotoList.map((n, i) => `${i + 1}. ${n}`).join("\n")}
              placeholder={selectedPhotoList.length ? "" : "Selected photos appear here"}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              title="You can copy the list of selected photos"
              onClick={handleCopyToClipboard}
              disabled={selectedPhotoList.length === 0 || isCopying}
            >
              {isCopying ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        {/* Selected list card removed; moved into sticky toolbar above */}

        {selectedFolderName && !isLoading && allPhotos.length > 0 && (
          <Card className="m-2">
            <CardHeader>
              <CardTitle>
                Photos in &quot;{selectedFolderName}&quot; ({allPhotos.length} found)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Quick actions for highlighted photos */}
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs p-2 -mx-2 rounded">
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setActiveFlag("pick")}><Flag className="h-3.5 w-3.5 mr-1" />Pick</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setActiveFlag("reject")}><XIcon className="h-3.5 w-3.5 mr-1" />Reject</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setActiveFlag("none")}>Clear</Button>
                </div>
                <div className="ml-2 flex items-center gap-1">
                  <span className="text-muted-foreground">Rating</span>
                  {[0,1,2,3,4,5].map((r) => (
                    <Button key={r} size="sm" variant="outline" className="h-8" onClick={() => setActiveRating(r)}>
                      <Star className="h-3.5 w-3.5 mr-1" /> {r}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Filters */}
              {showFilters && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded border bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Min Rating</span>
                  <Select value={String(minRatingFilter)} onValueChange={(v) => setMinRatingFilter(parseInt(v, 10))}>
                    <SelectTrigger size="sm" className="w-[110px]"><SelectValue placeholder="0" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0+</SelectItem>
                      <SelectItem value="1">1+</SelectItem>
                      <SelectItem value="2">2+</SelectItem>
                      <SelectItem value="3">3+</SelectItem>
                      <SelectItem value="4">4+</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Flag</span>
                  <Select value={flagFilter} onValueChange={(v) => setFlagFilter(v as typeof flagFilter)}>
                    <SelectTrigger size="sm" className="w-[140px]"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pick">Pick</SelectItem>
                      <SelectItem value="reject">Reject</SelectItem>
                      <SelectItem value="unflagged">Unflagged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              )}
              <InfiniteScroll
                dataLength={visiblePhotos.length}
                next={loadMorePhotos}
                hasMore={hasMore}
                loader={
                  <p className="text-center col-span-full py-4">
                    Loading more photos...
                  </p>
                }
                endMessage={null}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
              >
                {visiblePhotos.filter((photo) => {
                  const key = photo.relativePath || photo.name;
                  const rating = ratingsByKey[key] ?? 0;
                  const flag = flagsByKey[key] ?? "none";
                  if (rating < minRatingFilter) return false;
                  if (flagFilter === "pick" && flag !== "pick") return false;
                  if (flagFilter === "reject" && flag !== "reject") return false;
                  if (flagFilter === "unflagged" && flag !== "none") return false;
                  return true;
                }).map((photo) => {
                  const originalIndex = allPhotos.findIndex(
                    (p) => p.relativePath === photo.relativePath
                  );
                  return (
                    <PhotoCard
                      key={photo.relativePath || photo.name}
                      index={originalIndex !== -1 ? originalIndex : 0}
                      photo={photo}
                      isSelected={selectedPhotos.has(photo.name)}
                      isHighlighted={highlightedPhotos.has(photo.name)}
                      onSelectToggle={handlePhotoSelectToggle}
                      onHighlightToggle={handlePhotoHighlightToggle}
                      onViewRequest={handleViewPhotoRequest}
                      rating={ratingsByKey[photo.relativePath || photo.name] ?? 0}
                      flag={flagsByKey[photo.relativePath || photo.name] ?? "none"}
                      onSetActiveKey={() => setLastActiveKey(photo.relativePath || photo.name)}
                    />
                  );
                })}
              </InfiniteScroll>
            </CardContent>
          </Card>
        )}

        {isLoading && allPhotos.length === 0 && (
          <p className="text-center py-4">Loading photos...</p>
        )}
      </div>

      {/* Custom lightweight fullscreen viewer using Dialog */}
      <Dialog open={viewerIndex >= 0} onOpenChange={(o) => { if (!o) handleCloseLightbox(); }}>
        {viewerIndex >= 0 && allPhotos[viewerIndex] && (
          <DialogContent className="sm:max-w-[100vw] w-[100vw] h-[100vh] p-0 border-0">
            <DialogHeader>
              <DialogTitle className="sr-only">Viewer</DialogTitle>
            </DialogHeader>
            <DialogClose className="absolute top-3 right-3 z-[10005] bg-black/80 text-white rounded-full px-2 py-1">✕</DialogClose>
            {/* Top controls row */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[10001] flex items-center gap-3">
              <Select onValueChange={(v) => {
                if (v === "orig") downloadCurrent("original");
                if (v === "4k") downloadCurrent("4k");
                if (v === "lg") downloadCurrent("large");
                if (v === "md") downloadCurrent("medium");
                if (v === "sm") downloadCurrent("small");
                if (v === "webp") downloadCurrent("webp-1080");
              }}>
                <SelectTrigger size="sm" className="w-[178px] bg-black text-white border-white/30 hover:bg-black/90 rounded-full shadow-md px-4"><SelectValue placeholder="Download" /></SelectTrigger>
                <SelectContent className="z-[10002]">
                  <SelectItem value="orig">Original</SelectItem>
                  <SelectItem value="4k">4K (3840px)</SelectItem>
                  <SelectItem value="lg">Large (2560px)</SelectItem>
                  <SelectItem value="md">Medium (1920px)</SelectItem>
                  <SelectItem value="sm">Small (1280px)</SelectItem>
                  <SelectItem value="webp">WebP 1080p</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setShowStats((s) => !s)} aria-label="Toggle info" className="bg-black text-white border-white/30 hover:bg-black/90 rounded-full shadow-md px-3">?</Button>
            </div>
            {/* Image area with reserved top space and zoom/pan */}
            <div className="absolute inset-0 bg-black/90">
              <div
                className="h-full w-full pt-20 flex items-center justify-center overflow-hidden"
                onWheel={(e) => {
                  e.preventDefault();
                  const delta = -e.deltaY;
                  const factor = delta > 0 ? 1.1 : 0.9;
                  setZoomScale((prev) => Math.min(5, Math.max(1, prev * factor)));
                }}
                onMouseDown={(e) => {
                  if (zoomScale <= 1) return;
                  isPanningRef.current = true;
                  lastPosRef.current = { x: e.clientX, y: e.clientY };
                }}
                onMouseMove={(e) => {
                  if (!isPanningRef.current) return;
                  const dx = e.clientX - lastPosRef.current.x;
                  const dy = e.clientY - lastPosRef.current.y;
                  lastPosRef.current = { x: e.clientX, y: e.clientY };
                  setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
                }}
                onMouseUp={() => { isPanningRef.current = false; }}
                onMouseLeave={() => { isPanningRef.current = false; }}
                onDoubleClick={() => {
                  setZoomScale((z) => (z > 1 ? 1 : 2));
                  if (zoomScale <= 1) setOffset({ x: 0, y: 0 });
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lightboxObjectUrlsRef.current[viewerIndex]}
                  alt=""
                  style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoomScale})`, transformOrigin: "center center" }}
                  className="max-h-[calc(100vh-96px)] max-w-[95vw] object-contain select-none"
                  draggable={false}
                />
              </div>
            </div>
            {/* Stats panel */}
            {showStats && (
              <div className="absolute top-[72px] left-1/2 -translate-x-1/2 z-[10003] w-[95vw] max-w-3xl">
                <div className="rounded-md border bg-popover/95 text-popover-foreground shadow-md backdrop-blur p-3 text-xs max-h-[40vh] overflow-auto">
                  {(() => {
                    const p = allPhotos[viewerIndex]!;
                    const key = p.relativePath || p.name;
                    const dims = photoDimensionsByPath[key];
                    const exif = exifByPath[key] || {};
                    return (
                      <div className="space-y-1.5">
                        <div className="font-semibold text-sm truncate" title={p.name}>{p.name}</div>
                        <div className="grid grid-cols-3 gap-x-3 gap-y-1">
                          <div className="text-muted-foreground">Type</div>
                          <div className="col-span-2 truncate" title={p.fileHandle.type || "unknown"}>{p.fileHandle.type || "unknown"}</div>
                          <div className="text-muted-foreground">Size</div>
                          <div className="col-span-2">{formatFileSize(p.fileHandle.size)}</div>
                          <div className="text-muted-foreground">Dims</div>
                          <div className="col-span-2">{dims ? `${dims.width} × ${dims.height}` : "-"}</div>
                          <div className="text-muted-foreground">Path</div>
                          <div className="col-span-2 truncate" title={p.relativePath}>{p.relativePath}</div>
                          <div className="text-muted-foreground">Index</div>
                          <div className="col-span-2">{viewerIndex + 1} / {allPhotos.length}</div>
                          <div className="col-span-3 h-px bg-border my-1" />
                          <div className="text-muted-foreground">Camera</div>
                          <div className="col-span-2 truncate" title={`${(exif.Make as string ?? "")} ${(exif.Model as string ?? "")}`.trim()}>
                            {`${(exif.Make as string ?? "")} ${(exif.Model as string ?? "")}`.trim() || "-"}
                          </div>
                          <div className="text-muted-foreground">Lens</div>
                          <div className="col-span-2 truncate" title={(exif.LensModel as string) || ""}>{(exif.LensModel as string) || "-"}</div>
                          <div className="text-muted-foreground">ISO</div>
                          <div className="col-span-2">{(exif.ISO as number) || "-"}</div>
                          <div className="text-muted-foreground">Shutter</div>
                          <div className="col-span-2">{(exif.ExposureTime as number) ? `1/${Math.round(1 / (exif.ExposureTime as number))}s` : "-"}</div>
                          <div className="text-muted-foreground">Aperture</div>
                          <div className="col-span-2">{(exif.FNumber as number) ? `f/${exif.FNumber}` : "-"}</div>
                          <div className="text-muted-foreground">Focal</div>
                          <div className="col-span-2">{(exif.FocalLength as number) ? `${exif.FocalLength}mm` : "-"}</div>
                          <div className="text-muted-foreground">Taken</div>
                          <div className="col-span-2">{(exif.DateTimeOriginal as Date)?.toLocaleString?.() || String(exif.DateTimeOriginal || "-")}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>

      {/* Compare dialog */}
      <Dialog open={isCompareOpen} onOpenChange={(o) => (o ? openCompareIfTwoSelected() : closeCompare())}>
        <DialogContent className="sm:max-w-[100vw] w-[100vw] h-[100vh] p-0 border-0 bg-black">
          <DialogHeader>
            <DialogTitle className="sr-only">Compare</DialogTitle>
            <DialogDescription className="sr-only">Fullscreen compare</DialogDescription>
          </DialogHeader>
          <DialogClose className="absolute top-3 right-3 z-[10005] bg-black/80 text-white rounded-full px-2 py-1">✕</DialogClose>
          <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-2 gap-0">
            {[0,1].map((i) => (
              <div
                key={i}
                className="relative h-full w-full overflow-hidden bg-black"
                onWheel={(e) => {
                  e.preventDefault();
                  const delta = -e.deltaY;
                  const factor = delta > 0 ? 1.1 : 0.9;
                  setCompareZoomScales((prev) => {
                    const next: [number, number] = [...prev] as [number, number];
                    next[i] = Math.min(5, Math.max(1, prev[i] * factor));
                    return next;
                  });
                }}
                onMouseDown={(e) => {
                  if (compareZoomScales[i] <= 1) return;
                  comparePanningRef.current[i] = true;
                  compareLastPosRef.current[i] = { x: e.clientX, y: e.clientY };
                }}
                onMouseMove={(e) => {
                  if (!comparePanningRef.current[i]) return;
                  const last = compareLastPosRef.current[i];
                  const dx = e.clientX - last.x;
                  const dy = e.clientY - last.y;
                  compareLastPosRef.current[i] = { x: e.clientX, y: e.clientY };
                  setCompareOffsets((prev) => {
                    const next: [{x:number;y:number},{x:number;y:number}] = [ { ...prev[0] }, { ...prev[1] } ];
                    next[i] = { x: prev[i].x + dx, y: prev[i].y + dy };
                    return next;
                  });
                }}
                onMouseUp={() => { comparePanningRef.current[i] = false; }}
                onMouseLeave={() => { comparePanningRef.current[i] = false; }}
                onDoubleClick={() => {
                  setCompareZoomScales((prev) => {
                    const next: [number, number] = [...prev] as [number, number];
                    next[i] = prev[i] > 1 ? 1 : 2;
                    return next;
                  });
                  setCompareOffsets((prev) => {
                    const next: [{x:number;y:number},{x:number;y:number}] = [ { ...prev[0] }, { ...prev[1] } ];
                    if (compareZoomScales[i] <= 1) next[i] = { x: 0, y: 0 };
                    return next;
                  });
                }}
              >
                {compareUrls[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={compareUrls[i]}
                    alt={compareNames[i] || ""}
                    className="absolute inset-0 object-contain select-none"
                    draggable={false}
                    style={{
                      width: "100%",
                      height: "100%",
                      transform: `translate(${compareOffsets[i].x}px, ${compareOffsets[i].y}px) scale(${compareZoomScales[i]})`,
                      transformOrigin: "center center",
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">Select two photos to compare</div>
                )}
                <div className="absolute bottom-2 left-2 text-[11px] px-1.5 py-0.5 rounded bg-background/80 border truncate max-w-[90%]" title={compareNames[i] || ""}>{compareNames[i] || ""}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface PhotoCardProps {
  photo: DisplayPhoto;
  index: number;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelectToggle: (photoName: string) => void;
  onHighlightToggle: (photoName: string) => void;
  onViewRequest: (index: number) => void;
  rating: number;
  flag: "none" | "pick" | "reject";
  onSetActiveKey: () => void;
}

const PhotoCard = React.memo(
  ({ photo, index, isSelected, isHighlighted, onSelectToggle, onHighlightToggle, onViewRequest, rating, flag, onSetActiveKey }: PhotoCardProps) => {
    const cardId = `photo-card-${photo.name.replace(/[^a-zA-Z0-9]/g, "-")}`;
    const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [imageError, setImageError] = useState(false);

    // Do not revoke object URL on unmount here; managed at parent level to
    // avoid breaking thumbnails when filters cause unmount/remount cycles.

    // Only double-click opens viewer; selection is via explicit button
    const handleDoubleClick = useCallback(() => {
      onViewRequest(index);
      onSetActiveKey();
    }, [onViewRequest, onSetActiveKey, index]);

    useEffect(() => {
      const timeoutId = clickTimeoutRef.current;
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
      };
    }, []);

    const handleImageError = useCallback(() => {
      console.warn(`Failed to load image preview: ${photo.name}`);
      setImageError(true);
      if (photo.objectUrl.startsWith("blob:")) {
        URL.revokeObjectURL(photo.objectUrl);
      }
    }, [photo.name, photo.objectUrl]);

    return (
      <Card
        className={`cursor-default transition-all duration-200 ease-in-out relative group rounded-md ${
          isSelected
            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
            : isHighlighted
            ? "ring-2 ring-dashed ring-muted-foreground/60 ring-offset-2 ring-offset-background"
            : "hover:shadow-sm"
         } ${imageError ? "bg-destructive/10" : "bg-muted/30"}`}
        onDoubleClick={handleDoubleClick}
        onClick={() => onHighlightToggle(photo.name)}
        role="button"
        aria-pressed={isSelected}
        aria-label={`Photo: ${photo.name}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onViewRequest(index);
          }
        }}
      >
        <CardContent className="p-0 aspect-square relative">
          {/* Rating/Flag badges */}
          <div className="absolute left-2 top-2 z-10 flex items-center gap-1">
            {rating > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-yellow-200/90 text-yellow-900 border border-yellow-300 flex items-center gap-1">
                <Star className="h-3 w-3" /> {rating}
              </span>
            )}
            {flag === "pick" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-200/90 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                <Flag className="h-3 w-3" /> Pick
              </span>
            )}
            {flag === "reject" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-rose-200/90 text-rose-900 border border-rose-300 flex items-center gap-1">
                <XIcon className="h-3 w-3" /> Reject
              </span>
            )}
          </div>
          {imageError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-destructive/80 p-2">
              <ImageOff className="w-1/3 h-1/3 mb-1" />
              <p className="text-xs text-center line-clamp-2">{photo.name}</p>
              <p className="text-xs font-semibold mt-1">Load Error</p>
            </div>
          ) : (
            <Image
              src={photo.objectUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
              style={{ objectFit: "contain" }}
              priority={false}
              quality={70}
              onError={handleImageError}
              draggable="false"
              className=""
              decoding="async"
            />
          )}
          <div className="absolute top-2 right-2 z-10 bg-background/80 backdrop-blur-sm rounded-full p-0.5 pointer-events-auto">
            <Checkbox
              id={cardId}
              checked={isSelected}
              onCheckedChange={() => onSelectToggle(photo.name)}
              className="w-5 h-5"
            />
          </div>
        </CardContent>
      </Card>
    );
  }
);

PhotoCard.displayName = "PhotoCard";


