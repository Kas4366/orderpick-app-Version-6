/**
 * Helper function to find and load image files from local folder using STRICT matching
 * Only looks for exact SKU match with common image extensions
 * @param imagesFolderHandle The directory handle for the images folder
 * @param sku The SKU to search for (must match exactly)
 * @returns Promise<string> The blob URL for the image, or empty string if not found
 */
export async function findImageFile(
  imagesFolderHandle: FileSystemDirectoryHandle,
  sku: string
): Promise<string> {
  console.log(`🔍 Starting STRICT image search for SKU: "${sku}"`);
  console.log(`📁 Searching in folder: "${imagesFolderHandle.name}"`);

  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];

  const filenamesToTry = [
    sku,
  ];

  imageExtensions.forEach(ext => {
    filenamesToTry.push(`${sku}.${ext}`);
    filenamesToTry.push(`${sku}.${ext.toUpperCase()}`);
  });

  console.log(`🔍 Trying ${filenamesToTry.length} exact filename variations...`);

  for (const filename of filenamesToTry) {
    try {
      console.log(`🔍 Trying exact filename: "${filename}"`);
      const imageFileHandle = await imagesFolderHandle.getFileHandle(filename);
      const imageFile = await imageFileHandle.getFile();

      const imageUrl = URL.createObjectURL(imageFile);
      console.log(`✅ Found exact match: "${filename}" (${imageFile.size} bytes)`);
      return imageUrl;
    } catch (error) {
      continue;
    }
  }

  console.warn(`⚠️ No exact image match found for SKU: "${sku}"`);
  console.log(`📋 Searched for exact filenames: ${filenamesToTry.join(', ')}`);

  return '';
}

const designFileExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'pdf'];

export interface CustomDesignFile {
  url: string;
  isPdf: boolean;
}

// --- Folder listing cache ---
// Enumerating a folder one-file-at-a-time is slow (84+ async attempts per order).
// We enumerate the full folder tree once and cache the result so subsequent
// order lookups are just in-memory map lookups — near-instant.

interface CachedFileEntry {
  name: string;
  handle: FileSystemFileHandle;
  isPdf: boolean;
}

const folderCache = new WeakMap<FileSystemDirectoryHandle, Promise<CachedFileEntry[]>>();

async function enumerateAllFiles(dirHandle: FileSystemDirectoryHandle): Promise<CachedFileEntry[]> {
  const entries: CachedFileEntry[] = [];

  async function scanDir(dir: FileSystemDirectoryHandle) {
    for await (const entry of dir.values()) {
      if (entry.kind === 'directory') {
        await scanDir(entry as FileSystemDirectoryHandle);
      } else {
        const lowerName = entry.name.toLowerCase();
        const dotIdx = lowerName.lastIndexOf('.');
        const ext = dotIdx > 0 ? lowerName.substring(dotIdx + 1) : '';
        if (designFileExtensions.includes(ext)) {
          entries.push({
            name: entry.name,
            handle: entry as FileSystemFileHandle,
            isPdf: ext === 'pdf',
          });
        }
      }
    }
  }

  await scanDir(dirHandle);
  console.log(`📁 Folder enumeration complete: ${entries.length} design files cached in "${dirHandle.name}"`);
  return entries;
}

function getFolderListing(dirHandle: FileSystemDirectoryHandle): Promise<CachedFileEntry[]> {
  let listing = folderCache.get(dirHandle);
  if (!listing) {
    listing = enumerateAllFiles(dirHandle);
    folderCache.set(dirHandle, listing);
  }
  return listing;
}

/**
 * Find custom design file(s) for an order by Veeqo order ID.
 *
 * Uses a cached folder listing for fast repeated lookups (instant after first search).
 * Deduplicates by slot: only one file per design slot (main, position, Inside, Front).
 * For multi-quantity single items, looks for veeqoId-1 through veeqoId-{quantity}.
 * For grouped items, looks for veeqoId-{itemPosition}.
 * Card designs (Inside, Front) are separate slots so both display for cards.
 * Non-Amazon filenames are preferred over Amz- prefixed ones when both exist.
 */
export async function findCustomDesignImages(
  customDesignFolderHandle: FileSystemDirectoryHandle,
  veeqoOrderId: string | number,
  itemPosition?: number,
  quantity?: number
): Promise<CustomDesignFile[]> {
  if (!veeqoOrderId) return [];

  const id = String(veeqoOrderId);

  // Build slot patterns: each slot maps to base names to try (first match wins, non-Amz preferred)
  const slots: { key: string; names: string[] }[] = [];

  // Main design
  slots.push({ key: 'main', names: [id, `Amz-${id}`] });

  // Position-specific file (for grouped/multi-item orders)
  if (itemPosition && itemPosition > 0) {
    slots.push({ key: `pos-${itemPosition}`, names: [`${id}-${itemPosition}`, `Amz-${id}-${itemPosition}`] });
  }

  // Quantity-specific files (for multi-quantity single items)
  if (!itemPosition && quantity && quantity > 1) {
    for (let q = 1; q <= quantity; q++) {
      slots.push({ key: `qty-${q}`, names: [`${id}-${q}`, `Amz-${id}-${q}`] });
    }
  }

  // Card designs
  slots.push({ key: 'Inside', names: [`${id}-Inside`, `Amz-${id}-Inside`] });
  slots.push({ key: 'Front', names: [`${id}-Front`, `Amz-${id}-Front`] });

  try {
    const files = await getFolderListing(customDesignFolderHandle);

    // Build a map of lowercase base name -> file entry for O(1) lookup
    const fileMap = new Map<string, CachedFileEntry>();
    for (const file of files) {
      const dotIdx = file.name.lastIndexOf('.');
      const baseName = dotIdx > 0 ? file.name.substring(0, dotIdx) : file.name;
      const lowerBase = baseName.toLowerCase();
      if (!fileMap.has(lowerBase)) {
        fileMap.set(lowerBase, file);
      }
    }

    // Match slots to files, deduplicating by file handle
    const matchedFiles: CachedFileEntry[] = [];
    const seenHandles = new Set<FileSystemFileHandle>();

    for (const slot of slots) {
      for (const name of slot.names) {
        const file = fileMap.get(name.toLowerCase());
        if (file && !seenHandles.has(file.handle)) {
          matchedFiles.push(file);
          seenHandles.add(file.handle);
          break;
        }
      }
    }

    // Load matched files and create blob URLs
    const results: CustomDesignFile[] = [];
    for (const file of matchedFiles) {
      try {
        const blob = await file.handle.getFile();
        results.push({ url: URL.createObjectURL(blob), isPdf: file.isPdf });
      } catch {
        // File access failed, skip
      }
    }

    console.log(`🎨 Custom design search for ${id}: found ${results.length} file(s) from ${slots.length} slot(s)`);
    return results;
  } catch (error) {
    console.error(`❌ Error searching custom design folder for ${id}:`, error);
    return [];
  }
}
