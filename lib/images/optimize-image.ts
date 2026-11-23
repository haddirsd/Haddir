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

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
      dispose: () => bitmap.close(),
    };
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

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error("المتصفح لم يتمكن من تحويل الصورة إلى WebP.")),
      "image/webp",
      quality,
    );
  });
}

export async function optimizeImageToWebp(
  file: File,
  options: ImageOptimizationOptions,
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
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("تعذر تجهيز الصورة للمعالجة.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, width, height);

    let blob: Blob | null = null;
    const qualities = [options.quality, options.quality - 0.07, options.quality - 0.14, 0.68];
    for (const quality of [...new Set(qualities)].filter(value => value >= 0.6)) {
      const candidate = await canvasToWebp(canvas, quality);
      if (candidate.type !== "image/webp") {
        throw new Error("المتصفح لا يدعم تحويل الصور إلى WebP.");
      }
      if (candidate.size <= options.maxOutputBytes) {
        blob = candidate;
        break;
      }
    }

    if (!blob) {
      throw new Error("تعذر تقليل حجم الصورة إلى الحد المسموح. اختر صورة أصغر.");
    }

    const originalName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], originalName + ".webp", {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } finally {
    decoded.dispose();
  }
}
