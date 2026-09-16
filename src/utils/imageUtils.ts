import { Order } from '../types/Order';

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
  
  // Only try exact SKU with different extensions (both lowercase and uppercase extensions)
  const filenamesToTry = [
    sku, // Exact SKU without extension
  ];
  
  // Add exact SKU with each extension in both cases
  imageExtensions.forEach(ext => {
    filenamesToTry.push(`${sku}.${ext}`);      // SKU.jpg
    filenamesToTry.push(`${sku}.${ext.toUpperCase()}`); // SKU.JPG
  });
  
  console.log(`🔍 Trying ${filenamesToTry.length} exact filename variations...`);
  
  // Try to find any of these exact filenames
  for (const filename of filenamesToTry) {
    try {
      console.log(`🔍 Trying exact filename: "${filename}"`);
      const imageFileHandle = await imagesFolderHandle.getFileHandle(filename);
      const imageFile = await imageFileHandle.getFile();
      
      // Create a blob URL for the image
      const imageUrl = URL.createObjectURL(imageFile);
      console.log(`✅ Found exact match: "${filename}" (${imageFile.size} bytes)`);
      return imageUrl;
    } catch (error) {
      // File not found, continue to next filename
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

/**
 * Recursively search a directory and all subdirectories for files matching a set of base names.
 * Returns typed results with blob URLs and PDF flag.
 */
async function findFilesRecursively(
  dirHandle: FileSystemDirectoryHandle,
  baseNames: string[]
): Promise<CustomDesignFile[]> {
  const results: CustomDesignFile[] = [];
  const extensions = designFileExtensions;

  const tryNames: string[] = [];
  for (const base of baseNames) {
    for (const ext of extensions) {
      tryNames.push(`${base}.${ext}`);
      tryNames.push(`${base}.${ext.toUpperCase()}`);
    }
  }

  // Check files in current directory
  for (const tryName of tryNames) {
    try {
      const fileHandle = await dirHandle.getFileHandle(tryName);
      const file = await fileHandle.getFile();
      const isPdf = tryName.toLowerCase().endsWith('.pdf');
      results.push({ url: URL.createObjectURL(file), isPdf });
      console.log(`✅ Found custom design file: "${tryName}" in "${dirHandle.name}" (PDF: ${isPdf})`);
    } catch {
      // not found, continue
    }
  }

  // Recurse into subdirectories
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'directory') {
      const subResults = await findFilesRecursively(entry as FileSystemDirectoryHandle, baseNames);
      results.push(...subResults);
    }
  }

  return results;
}

/**
 * Find custom design label file(s) for an order by Veeqo order ID.
 * Searches the entire custom design folder recursively.
 * Handles: single items (veeqoId), multi-items (veeqoId-N), cards (veeqoId-Inside, veeqoId-Front),
 * and Amazon prefix (Amz-veeqoId).
 * Supports both image files (jpg, png, etc.) and PDF files.
 * Returns array of typed results (0, 1, or multiple files).
 */
export async function findCustomDesignImages(
  customDesignFolderHandle: FileSystemDirectoryHandle,
  veeqoOrderId: string | number,
  itemPosition?: number
): Promise<CustomDesignFile[]> {
  if (!veeqoOrderId) return [];

  const id = String(veeqoOrderId);
  const baseNames: string[] = [id, `Amz-${id}`];

  if (itemPosition && itemPosition > 0) {
    baseNames.push(`${id}-${itemPosition}`, `Amz-${id}-${itemPosition}`);
  }

  // Card designs: Inside and Front
  baseNames.push(`${id}-Inside`, `Amz-${id}-Inside`);
  baseNames.push(`${id}-Front`, `Amz-${id}-Front`);

  console.log(`🎨 Searching custom design folder for Veeqo ID: ${id}, base names:`, baseNames);

  try {
    const results = await findFilesRecursively(customDesignFolderHandle, baseNames);
    console.log(`🎨 Custom design search complete for ${id}: found ${results.length} file(s)`);
    return results;
  } catch (error) {
    console.error(`❌ Error searching custom design folder for ${id}:`, error);
    return [];
  }
}