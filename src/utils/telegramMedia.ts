import type { Message } from "grammy/types";

export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

export function selectMedia(message: Message) {
  if ("photo" in message && message.photo?.length) {
    const photo = message.photo[message.photo.length - 1]!;
    return { id: photo.file_id, size: photo.file_size, name: "photo.jpg", type: "image/jpeg" };
  }
  for (const key of ["document", "video", "animation"] as const) {
    if (key in message) {
      const file = (message as Message.DocumentMessage & Message.VideoMessage & Message.AnimationMessage)[key];
      if (file) return { id: file.file_id, size: file.file_size,
        name: file.file_name || (key === "document" ? "document.bin" : "video.mp4"),
        type: file.mime_type || (key === "document" ? "application/octet-stream" : "video/mp4") };
    }
  }
  if ("sticker" in message && message.sticker) {
    const sticker = message.sticker;
    // Telegram TGS requires a Lottie renderer; use its preview rather than send an unrenderable file.
    const file = sticker.is_animated ? sticker.thumbnail : sticker;
    if (!file) throw new Error("Sticker has no preview");
    return { id: file.file_id, size: file.file_size,
      name: sticker.is_animated ? "sticker-preview.jpg" : sticker.is_video ? "sticker.webm" : "sticker.webp",
      type: sticker.is_animated ? "image/jpeg" : sticker.is_video ? "video/webm" : "image/webp" };
  }
  return undefined;
}
