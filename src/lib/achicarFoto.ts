// Fotos de cámara a resolución completa (12-50MP) dejan sin memoria al navegador del
// celular cuando se muestran en la grilla o se meten en el PDF, y la página se cierra
// ("This page couldn't load"). Se achican a MAX_FOTO_DIM antes de subirlas.
// No se usa createImageBitmap({ resizeWidth }): Safari de iPhone ignora esa opción.
const MAX_FOTO_DIM = 1600;

export async function achicarFoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size < 800_000) return file;
  const original = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = original;
    await img.decode();
    const escala = Math.min(1, MAX_FOTO_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = "";
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.85);
    });
    canvas.width = canvas.height = 0;
    return blob;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(original);
  }
}

// Nombre de archivo para Storage: si la foto se re-codificó a JPEG, la extensión acompaña.
export const nombreFoto = (file: File, blob: Blob) =>
  blob === file ? file.name : file.name.replace(/\.[^.]+$/, "") + ".jpg";
