import type { Participant, PhotoUpload, TripPhoto } from "@/domain/types";
import { createId } from "@/lib/id";
import { addTripPhotoFromUpload, deleteTripPhoto, updateParticipant } from "./repository";
import { db } from "./database";
import { getSupabase } from "./supabase";
import { currentUserId } from "./auth";

const PROFILE_BUCKET = "profile-photos";
const MEMORY_BUCKET = "trip-photos";
const MAX_SOURCE_SIZE = 25 * 1024 * 1024;
const MAX_LOCAL_QUEUE_SIZE = 30 * 1024 * 1024;
const PHOTO_REFERENCE_PREFIX = "storage:";
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;

export type PhotoStage = "preparing" | "uploading" | "queued" | "done";
export interface QueuePhotoResult { status: "uploaded" | "queued"; uploadId: string }

function assertPhoto(file: File): void {
  const imageMime = file.type.startsWith("image/");
  if (!imageMime && !ACCEPTED_EXTENSIONS.test(file.name)) throw new Error("Choisissez une photo JPEG, PNG, WebP, HEIC ou HEIF.");
  if (file.size > MAX_SOURCE_SIZE) throw new Error("Cette photo dépasse 25 Mo. Choisissez une version moins lourde.");
  if (!file.size) throw new Error("Cette photo est vide.");
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Cette photo HEIC/HEIF ne peut pas être décodée par cette version d’iOS. Dans Photos, partage-la en JPEG puis réessaie.")); };
    image.src = objectUrl;
  });
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch { /* Safari iOS peut décoder via Image sans exposer ImageBitmap. */ }
  }
  const image = await loadHtmlImage(file);
  return { source: image, width: image.naturalWidth, height: image.naturalHeight };
}

export async function optimizePhoto(file: File, kind: "avatar" | "memory"): Promise<{ blob: Blob; extension: "webp" | "jpeg" }> {
  assertPhoto(file);
  const image = await decode(file);
  try {
    const canvas = document.createElement("canvas");
    if (kind === "avatar") {
      const square = Math.min(image.width, image.height);
      canvas.width = 512; canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Impossible de préparer la photo.");
      context.drawImage(image.source, (image.width - square) / 2, (image.height - square) / 2, square, square, 0, 0, 512, 512);
    } else {
      const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Impossible de préparer la photo.");
      context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
    }
    const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", kind === "avatar" ? 0.82 : 0.8));
    if (webp?.type === "image/webp") return { blob: webp, extension: "webp" };
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", kind === "avatar" ? 0.84 : 0.82));
    if (!jpeg) throw new Error("Impossible de compresser la photo.");
    return { blob: jpeg, extension: "jpeg" };
  } finally { image.close?.(); }
}

function photoReference(bucket: string, path: string): string { return `${PHOTO_REFERENCE_PREFIX}${bucket}/${path}`; }

export function parsePhotoReference(value: string | null): { bucket: "profile-photos" | "trip-photos"; path: string } | null {
  if (!value) return null;
  const publicMarker = "/storage/v1/object/public/";
  if (!value.startsWith(PHOTO_REFERENCE_PREFIX) && value.includes(publicMarker)) {
    const rawPublic = value.slice(value.indexOf(publicMarker) + publicMarker.length).split("?")[0];
    const slash = rawPublic.indexOf("/");
    const bucket = rawPublic.slice(0, slash);
    if ((bucket === PROFILE_BUCKET || bucket === MEMORY_BUCKET) && slash >= 0) return { bucket, path: decodeURIComponent(rawPublic.slice(slash + 1)) };
    return null;
  }
  if (!value.startsWith(PHOTO_REFERENCE_PREFIX)) return null;
  const raw = value.slice(PHOTO_REFERENCE_PREFIX.length);
  const slash = raw.indexOf("/");
  const bucket = raw.slice(0, slash);
  if ((bucket !== PROFILE_BUCKET && bucket !== MEMORY_BUCKET) || slash < 0) return null;
  return { bucket, path: raw.slice(slash + 1) };
}

const signedCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Oublie l’URL signée d’une photo. Une PWA peut reprendre la main bien après
 * l’expiration : plutôt que de laisser une image cassée, la vue redemande une
 * signature fraîche pour cette photo-là, sans invalider toute la galerie.
 */
export function forgetSignedPhotoUrl(bucket: "profile-photos" | "trip-photos", path: string): void {
  signedCache.delete(`${bucket}:${path}`);
}

export async function getSignedPhotoUrl(bucket: "profile-photos" | "trip-photos", path: string): Promise<string | null> {
  const key = `${bucket}:${path}`;
  const cached = signedCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const client = getSupabase();
  if (!client || !path) return null;
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) return null;
  signedCache.set(key, { url: data.signedUrl, expiresAt: Date.now() + 50 * 60_000 });
  return data.signedUrl;
}

async function ensureQueueCapacity(blob: Blob): Promise<void> {
  const queued = await db.photoUploads.toArray();
  const total = queued.reduce((sum, item) => sum + item.blob.size, 0);
  if (total + blob.size > MAX_LOCAL_QUEUE_SIZE) throw new Error("La file photo hors ligne atteint 30 Mo. Reconnecte l’iPhone avant d’ajouter d’autres souvenirs.");
}

async function queuePhoto(input: Omit<PhotoUpload, "status" | "attempts" | "lastError">): Promise<void> {
  await ensureQueueCapacity(input.blob);
  await db.photoUploads.put({ ...input, status: "pending", attempts: 0, lastError: null });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("marrakech-photo-queue"));
}

async function finishOrQueue(uploadId: string, onStage?: (stage: PhotoStage) => void): Promise<QueuePhotoResult> {
  if (typeof navigator !== "undefined" && navigator.onLine) {
    onStage?.("uploading");
    await flushPhotoUploads();
    const remaining = await db.photoUploads.get(uploadId);
    if (!remaining) { onStage?.("done"); return { status: "uploaded", uploadId }; }
    if (remaining.status === "failed") throw new Error(remaining.lastError ?? "Impossible d’envoyer la photo.");
  }
  onStage?.("queued");
  return { status: "queued", uploadId };
}

export async function uploadParticipantPhoto(participant: Participant, file: File, onStage?: (stage: PhotoStage) => void): Promise<QueuePhotoResult> {
  onStage?.("preparing");
  const optimized = await optimizePhoto(file, "avatar");
  const id = createId();
  await queuePhoto({ id, tripId: participant.tripId, kind: "avatar", participantId: participant.id, photoId: null, blob: optimized.blob, extension: optimized.extension, takenAt: new Date(file.lastModified || Date.now()).toISOString(), createdAt: new Date().toISOString() });
  return finishOrQueue(id, onStage);
}

export async function queueMemoryPhoto(tripId: string, file: File, takenAt = new Date().toISOString(), onStage?: (stage: PhotoStage) => void): Promise<QueuePhotoResult> {
  onStage?.("preparing");
  const optimized = await optimizePhoto(file, "memory");
  const id = createId();
  await queuePhoto({ id, tripId, kind: "memory", participantId: null, photoId: id, blob: optimized.blob, extension: optimized.extension, takenAt, createdAt: new Date().toISOString() });
  return finishOrQueue(id, onStage);
}

let activeFlush: Promise<void> | null = null;

export function flushPhotoUploads(): Promise<void> {
  if (activeFlush) return activeFlush;
  activeFlush = flushPhotoUploadsOnce().finally(() => { activeFlush = null; });
  return activeFlush;
}

async function flushPhotoUploadsOnce(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const client = getSupabase();
  const userId = await currentUserId();
  if (!client || !userId) return;
  const readyTrips = new Set<string>();
  for (const upload of (await db.photoUploads.toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!readyTrips.has(upload.tripId)) {
      const { data: membership, error: membershipError } = await client.from("trip_members").select("trip_id").eq("trip_id", upload.tripId).eq("user_id", userId).maybeSingle();
      if (membershipError || !membership) {
        await db.photoUploads.update(upload.id, { status: "pending", lastError: membershipError?.message ?? "Le séjour finit de se synchroniser avant la photo." });
        continue;
      }
      readyTrips.add(upload.tripId);
    }
    await db.photoUploads.update(upload.id, { status: "uploading", lastError: null });
    const bucket = upload.kind === "avatar" ? PROFILE_BUCKET : MEMORY_BUCKET;
    const path = upload.kind === "avatar"
      ? `${upload.tripId}/${upload.participantId}/${upload.id}.${upload.extension}`
      : `${upload.tripId}/${upload.id}.${upload.extension}`;
    try {
      const { error } = await client.storage.from(bucket).upload(path, upload.blob, { cacheControl: "31536000", contentType: upload.extension === "webp" ? "image/webp" : "image/jpeg", upsert: true });
      if (error) throw error;
      if (upload.kind === "avatar" && upload.participantId) {
        const participant = await db.participants.get(upload.participantId);
        if (!participant || participant.deletedAt) throw new Error("Ce participant n’existe plus.");
        const previous = parsePhotoReference(participant.avatarUrl);
        await updateParticipant(participant, { avatarUrl: photoReference(PROFILE_BUCKET, path) });
        if (previous?.bucket === PROFILE_BUCKET && previous.path !== path) await client.storage.from(PROFILE_BUCKET).remove([previous.path]);
      } else {
        await addTripPhotoFromUpload({ id: upload.photoId ?? upload.id, tripId: upload.tripId, storagePath: path, takenAt: upload.takenAt, uploadedBy: userId, createdAt: upload.createdAt });
      }
      await db.photoUploads.delete(upload.id);
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("marrakech-photo-uploaded", { detail: { id: upload.id, kind: upload.kind } }));
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Impossible d’envoyer la photo.";
      const message = /row-level security|bucket|not found/i.test(raw)
        ? "Le stockage privé n’est pas prêt. Applique la migration Supabase 202608270006 puis réessaie."
        : raw;
      await db.photoUploads.update(upload.id, { status: "failed", attempts: upload.attempts + 1, lastError: message });
    }
  }
  await flushPhotoDeletes();
}

export async function retryPhotoUploads(): Promise<void> {
  await db.photoUploads.toCollection().modify({ status: "pending", lastError: null });
  await flushPhotoUploads();
}

const DELETE_SETTING = "pendingPhotoDeletes";
async function queueDelete(bucket: "profile-photos" | "trip-photos", path: string): Promise<void> {
  const stored = await db.settings.get(DELETE_SETTING);
  const values = stored ? JSON.parse(stored.value) as string[] : [];
  const key = `${bucket}:${path}`;
  if (!values.includes(key)) values.push(key);
  await db.settings.put({ key: DELETE_SETTING, value: JSON.stringify(values) });
}

async function flushPhotoDeletes(): Promise<void> {
  const client = getSupabase(); const stored = await db.settings.get(DELETE_SETTING);
  if (!client || !stored || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  const pending = JSON.parse(stored.value) as string[]; const failed: string[] = [];
  for (const item of pending) {
    const separator = item.indexOf(":"); const bucket = item.slice(0, separator) as "profile-photos" | "trip-photos"; const path = item.slice(separator + 1);
    const { error } = await client.storage.from(bucket).remove([path]); if (error) failed.push(item);
  }
  if (failed.length) await db.settings.put({ key: DELETE_SETTING, value: JSON.stringify(failed) }); else await db.settings.delete(DELETE_SETTING);
}

export async function removeParticipantPhoto(participant: Participant): Promise<void> {
  const reference = parsePhotoReference(participant.avatarUrl);
  await updateParticipant(participant, { avatarUrl: null });
  if (!reference) return;
  await queueDelete(reference.bucket, reference.path);
  await flushPhotoDeletes();
}

export async function removeTripPhoto(photo: TripPhoto): Promise<void> {
  await deleteTripPhoto(photo);
  await queueDelete(MEMORY_BUCKET, photo.storagePath);
  await flushPhotoDeletes();
}
