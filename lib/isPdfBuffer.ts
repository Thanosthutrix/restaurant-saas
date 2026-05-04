/** Détecte un PDF par signature binaire (%PDF), sans tenir compte du nom de fichier. */
export function isPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
}
