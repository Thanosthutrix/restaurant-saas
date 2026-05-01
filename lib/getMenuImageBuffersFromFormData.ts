/**
 * Extrait les images d’un FormData côté server action.
 * Ne pas utiliser `instanceof File` : sous Node / Next les pièces jointes sont souvent des Blob.
 */
export async function getImageBuffersFromFormData(formData: FormData, fieldName: string): Promise<Buffer[]> {
  const buffers: Buffer[] = [];
  for (const x of formData.getAll(fieldName)) {
    if (x == null) continue;
    if (typeof x === "string") continue;
    if (typeof x !== "object") continue;
    const blob = x as Blob;
    if (typeof blob.arrayBuffer !== "function") continue;
    if (typeof blob.size !== "number" || blob.size <= 0) continue;
    try {
      buffers.push(Buffer.from(await blob.arrayBuffer()));
    } catch {
      /* ignorer cette entrée */
    }
  }
  return buffers;
}

export async function getMenuImageBuffersFromFormData(formData: FormData): Promise<Buffer[]> {
  return getImageBuffersFromFormData(formData, "menu_image");
}
