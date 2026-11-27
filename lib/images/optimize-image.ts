export type ImageOptimizationOptions = {
  maxDimension: number;
  quality: number;
  maxOutputBytes: number;
};

type DecodedImage = {
  width: number;
  height: number;
  source: CanvasImageSource;
  dispose: () => void;
};

type EncodedImage = {
  blob: Blob;
  type: "image/webp" | "image/jpeg" | "image/png";
  extension: "webp" | "jpg" | "png";
};

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        width: bitmap.width,
        height: bitmap.height,
        source: bitmap,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Fall back to HTMLImageElement when the browser exposes but cannot use createImageBitmap.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    if (typeof image.decode === "function") {
      image.src = objectUrl;
      await image.decode();
    } else {
      const loadPromise = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("تعذر قراءة الصورة المختارة."));
      });
      image.src = objectUrl;
      await loadPromise;
    }
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      source: image,
      dispose: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error("تعذر تجهيز صورة الإيصال.")),
      type,
      quality,
    );
  });
}

function createImageCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("تعذر تجهيز الصورة للمعالجة.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

async function encodeImage(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  fileType: string,
  quality: number,
  maxOutputBytes: number,
  allowFallback: boolean,
): Promise<EncodedImage> {
  const qualities = [...new Set([quality, quality - 0.07, quality - 0.14, 0.68])]
    .filter(value => value >= 0.6);
  let webpSupported = true;

  for (const candidateQuality of qualities) {
    const candidate = await canvasToBlob(canvas, "image/webp", candidateQuality);
    if (candidate.type !== "image/webp") {
      webpSupported = false;
      break;
    }
    if (candidate.size <= maxOutputBytes) {
      return { blob: candidate, type: "image/webp", extension: "webp" };
    }
  }

  if (!allowFallback) {
    throw new Error(webpSupported
      ? "تعذر تقليل حجم الصورة إلى الحد المسموح. اختر صورة أصغر."
      : "المتصفح لا يدعم تحويل الصور إلى WebP.");
  }

  // Safari on iOS may return PNG when WebP encoding is requested.
  // Preserve PNG input; use JPEG for opaque photographic formats.
  if (fileType === "image/png") {
    let width = canvas.width;
    let height = canvas.height;
    while (true) {
      const pngCanvas = createImageCanvas(source, width, height);
      const candidate = await canvasToBlob(pngCanvas, "image/png");
      if (candidate.type !== "image/png") {
        throw new Error("المتصفح لم يتمكن من تجهيز صورة الإيصال بصيغة PNG.");
      }
      if (candidate.size <= maxOutputBytes) {
        return { blob: candidate, type: "image/png", extension: "png" };
      }
      if (Math.max(width, height) <= 320) break;
      width = Math.max(1, Math.round(width * 0.85));
      height = Math.max(1, Math.round(height * 0.85));
    }
  } else {
    for (const candidateQuality of qualities) {
      const candidate = await canvasToBlob(canvas, "image/jpeg", candidateQuality);
      if (candidate.type !== "image/jpeg") {
        throw new Error("المتصفح لم يتمكن من تجهيز صورة الإيصال بصيغة JPEG.");
      }
      if (candidate.size <= maxOutputBytes) {
        return { blob: candidate, type: "image/jpeg", extension: "jpg" };
      }
    }
  }

  throw new Error("تعذر تقليل حجم الصورة إلى الحد المسموح. اختر صورة أصغر.");
}

async function optimizeImage(
  file: File,
  options: ImageOptimizationOptions,
  allowFallback: boolean,
): Promise<File> {
  if (typeof document === "undefined") {
    throw new Error("معالجة الصور متاحة داخل المتصفح فقط.");
  }
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error("اختر صورة صالحة.");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type.toLowerCase())) {
    throw new Error("الصيغ المدعومة: JPG أو PNG أو WebP.");
  }

  let decoded: DecodedImage;
  try {
    decoded = await decodeImage(file);
  } catch {
    throw new Error("تعذر قراءة الصورة. اختر ملف صورة سليم بصيغة JPG أو PNG أو WebP.");
  }

  try {
    if (!decoded.width || !decoded.height || decoded.width * decoded.height > 40_000_000) {
      throw new Error("أبعاد الصورة كبيرة أو غير صالحة. اختر صورة بأبعاد أقل.");
    }

    const scale = Math.min(1, options.maxDimension / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = createImageCanvas(decoded.source, width, height);
    const encoded = await encodeImage(
      canvas,
      decoded.source,
      file.type.toLowerCase(),
      options.quality,
      options.maxOutputBytes,
      allowFallback,
    );

    const originalName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([encoded.blob], `${originalName}.${encoded.extension}`, {
      type: encoded.type,
      lastModified: Date.now(),
    });
  } finally {
    decoded.dispose();
  }
}


export function optimizeImageForUpload(
  file: File,
  options: ImageOptimizationOptions,
): Promise<File> {
  return optimizeImage(file, options, true);
}

export async function optimizeImageToWebp(
  file: File,
  options: ImageOptimizationOptions,
): Promise<File> {
  return optimizeImage(file, options, false);
}
