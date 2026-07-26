export type ProductPreviewLoaderParameters = {
  src: string;
  width: number;
  quality?: number;
};

const VERSIONED_CLOUDINARY_PREVIEW = /^https:\/\/res[.]cloudinary[.]com\/[a-z0-9_-]+\/image\/upload\/(v[1-9][0-9]*\/catalog-products\/[^?#]+[.](?:avif|gif|jpe?g|png|webp))$/;

export function isVersionedCloudinaryProductPreview(value: string) {
  return VERSIONED_CLOUDINARY_PREVIEW.test(value);
}

export function productPreviewLoader({ src, width }: ProductPreviewLoaderParameters) {
  const match = VERSIONED_CLOUDINARY_PREVIEW.exec(src);
  if (!match || !Number.isInteger(width) || width <= 0) {
    throw new Error("Invalid Product Preview transformation request");
  }

  const uploadPrefix = src.slice(0, src.indexOf("/image/upload/") + "/image/upload/".length);
  return `${uploadPrefix}f_auto,q_auto,c_limit,w_${width}/${match[1]}`;
}
