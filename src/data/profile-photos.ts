import type { Participant } from "@/domain/types";
import { createId } from "@/lib/id";
import { updateParticipant } from "./repository";
import { getSupabase } from "./supabase";
import { currentUserId } from "./auth";

const BUCKET = "profile-photos";
const MAX_SOURCE_SIZE = 5 * 1024 * 1024;
const OUTPUT_SIZE = 512;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("La photo n’a pas pu être lue."));
    };
    image.src = objectUrl;
  });
}

async function optimizePhoto(file: File): Promise<Blob> {
  const image = await loadImage(file);
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossible de préparer la photo.");
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new Error("Impossible de compresser la photo.");
  return blob;
}

function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return null;
  return decodeURIComponent(url.slice(markerIndex + marker.length).split("?")[0]);
}

export async function uploadParticipantPhoto(participant: Participant, file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error("Choisissez une image JPG, PNG ou WebP.");
  if (file.size > MAX_SOURCE_SIZE) throw new Error("La photo doit peser moins de 5 Mo.");
  if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error("Une connexion est nécessaire pour envoyer une photo.");

  const client = getSupabase();
  if (!client) throw new Error("Configurez Supabase avant d’ajouter des photos de profil.");
  if (!(await currentUserId())) throw new Error("Reconnecte-toi pour envoyer une photo.");

  const optimized = await optimizePhoto(file);
  const path = `${participant.tripId}/${participant.id}/${createId()}.webp`;
  const { error } = await client.storage.from(BUCKET).upload(path, optimized, {
    cacheControl: "31536000",
    contentType: "image/webp",
    upsert: false,
  });
  if (error) {
    if (/row-level security|not found|bucket/i.test(error.message)) {
      throw new Error("Le stockage des photos n’est pas prêt. Appliquez la dernière migration Supabase puis resynchronisez le séjour.");
    }
    throw error;
  }

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  await updateParticipant(participant, { avatarUrl: data.publicUrl });

  const previousPath = participant.avatarUrl ? storagePathFromPublicUrl(participant.avatarUrl) : null;
  if (previousPath) void client.storage.from(BUCKET).remove([previousPath]);
  return data.publicUrl;
}

export async function removeParticipantPhoto(participant: Participant): Promise<void> {
  await updateParticipant(participant, { avatarUrl: null });
  if (!participant.avatarUrl || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  const client = getSupabase();
  const path = storagePathFromPublicUrl(participant.avatarUrl);
  if (!client || !path || !(await currentUserId())) return;
  await client.storage.from(BUCKET).remove([path]);
}
