import React, { useEffect, useState } from 'react';
import { findCustomDesignImages, CustomDesignFile } from '../utils/imageUtils';

interface CustomDesignPanelProps {
  veeqoOrderId: string | number;
  quantity: number;
  itemPosition?: number;
  customDesignFolderHandle?: FileSystemDirectoryHandle | null;
  className?: string;
  minHeight?: string;
  label?: string;
}

export const CustomDesignPanel: React.FC<CustomDesignPanelProps> = ({
  veeqoOrderId,
  quantity,
  itemPosition,
  customDesignFolderHandle = null,
  className = '',
  minHeight = '500px',
  label = 'Custom Design',
}) => {
  const [designFiles, setDesignFiles] = useState<CustomDesignFile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const lookup = async () => {
      if (!customDesignFolderHandle || !veeqoOrderId) {
        setDesignFiles([]);
        return;
      }

      setLoading(true);
      try {
        const files = await findCustomDesignImages(
          customDesignFolderHandle,
          veeqoOrderId,
          itemPosition,
          quantity
        );
        setDesignFiles(files);
      } catch (error) {
        console.error('❌ Error looking up custom design files:', error);
        setDesignFiles([]);
      } finally {
        setLoading(false);
      }
    };

    lookup();
  }, [veeqoOrderId, quantity, itemPosition, customDesignFolderHandle]);

  if (designFiles.length === 0 && !loading) return null;

  return (
    <div
      className={`flex-1 bg-emerald-50 rounded-lg overflow-hidden relative flex items-center justify-center border-2 border-emerald-300 ${className}`}
      style={{ minHeight }}
    >
      <div className="absolute top-2 left-2 bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded z-10">
        {label}
      </div>

      {loading && (
        <div className="absolute top-2 right-2 flex items-center gap-1 text-xs text-gray-500 bg-white bg-opacity-80 px-2 py-1 rounded z-10">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-emerald-600"></div>
          <span>Searching...</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 p-2">
        {designFiles.map((file, idx) =>
          file.isPdf ? (
            <div key={idx} className="flex flex-col items-center gap-1">
              <embed
                src={file.url}
                type="application/pdf"
                className="max-w-full max-h-[460px] rounded border border-emerald-200"
                style={{ width: '400px', minHeight: '300px' }}
              />
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-700 hover:text-emerald-900 underline"
              >
                Open PDF in new tab
              </a>
            </div>
          ) : (
            <img
              key={idx}
              src={file.url}
              alt={`Custom design ${idx + 1} for Veeqo ID ${veeqoOrderId}`}
              className="max-w-full max-h-[480px] object-contain"
            />
          )
        )}
      </div>
    </div>
  );
};
