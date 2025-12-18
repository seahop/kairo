import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CloseIcon } from "@/components/common/Icons";

interface AttachmentResult {
  relative_path: string;
  renamed: boolean;
  original_name: string | null;
}

interface UploadedImage {
  path: string;
  altText: string;
  renamed: boolean;
  originalName: string | null;
}

const UploadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

interface ImageUploadProps {
  onClose?: () => void;
  className?: string;
}

export function ImageUpload({ onClose, className = "" }: ImageUploadProps) {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageFiles.length === 0) return;

    setIsUploading(true);

    try {
      for (const file of imageFiles) {
        const buffer = await file.arrayBuffer();
        const data = Array.from(new Uint8Array(buffer));

        const result = await invoke<AttachmentResult>("save_attachment", {
          filename: file.name,
          data,
        });

        const altText = file.name.replace(/\.[^/.]+$/, "");

        setUploadedImages((prev) => [
          ...prev,
          {
            path: result.relative_path,
            altText,
            renamed: result.renamed,
            originalName: result.original_name,
          },
        ]);
      }
    } catch (err) {
      console.error("Failed to upload image:", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, []);

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(id);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);

  const removeImage = useCallback((index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const getMarkdownOptions = (image: UploadedImage) => [
    {
      label: "Basic",
      code: `![${image.altText}](${image.path})`,
    },
    {
      label: "Width 300px",
      code: `![${image.altText}](${image.path}?w=300)`,
    },
    {
      label: "Width 500px",
      code: `![${image.altText}](${image.path}?w=500)`,
    },
    {
      label: "HTML (custom size)",
      code: `<img src="${image.path}" width="300" alt="${image.altText}" />`,
    },
  ];

  return (
    <div className={`bg-dark-850 rounded-lg border border-dark-700 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-dark-200">Upload Image</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-dark-500 hover:text-dark-300 rounded"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Upload area */}
      <div
        className="border border-dark-600 rounded-lg p-4 text-center cursor-pointer hover:border-accent-primary/50 hover:bg-dark-800/50 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <div className="flex flex-col items-center gap-2">
          <div className="p-2 bg-dark-700 rounded-lg">
            <UploadIcon />
          </div>
          <div className="text-sm text-dark-400">
            {isUploading ? (
              "Uploading..."
            ) : (
              <span className="text-accent-primary">Click to select images</span>
            )}
          </div>
          <div className="text-xs text-dark-500">PNG, JPG, GIF, WebP</div>
        </div>
      </div>

      {/* Uploaded images */}
      {uploadedImages.length > 0 && (
        <div className="mt-4 space-y-4">
          {uploadedImages.map((image, imageIndex) => (
            <div key={imageIndex} className="bg-dark-800 rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm font-medium text-dark-200">
                    {image.path.split("/").pop()}
                  </div>
                  {image.renamed && image.originalName && (
                    <div className="text-xs text-yellow-500">
                      Renamed from: {image.originalName}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeImage(imageIndex)}
                  className="p-1 text-dark-500 hover:text-red-400 rounded"
                  title="Remove from list"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="text-xs text-dark-500 mb-2">
                Copy markdown to paste in your document:
              </div>

              <div className="space-y-2">
                {getMarkdownOptions(image).map((option, optionIndex) => {
                  const copyId = `${imageIndex}-${optionIndex}`;
                  const isCopied = copiedIndex === copyId;

                  return (
                    <div
                      key={optionIndex}
                      className="flex items-center gap-2 group"
                    >
                      <code className="flex-1 text-xs bg-dark-900 px-2 py-1.5 rounded font-mono text-slate-300 truncate">
                        {option.code}
                      </code>
                      <button
                        onClick={() => copyToClipboard(option.code, copyId)}
                        className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                          isCopied
                            ? "bg-green-600 text-white"
                            : "bg-dark-700 text-dark-400 hover:bg-dark-600 hover:text-dark-200"
                        }`}
                        title={`Copy ${option.label}`}
                      >
                        {isCopied ? <CheckIcon /> : <CopyIcon />}
                        <span className="hidden sm:inline">
                          {isCopied ? "Copied" : option.label}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
