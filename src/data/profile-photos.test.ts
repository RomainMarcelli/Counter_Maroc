// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Participant, TripPhoto } from "@/domain/types";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn(), updateParticipant: vi.fn(), addTripPhoto: vi.fn(), deleteTripPhoto: vi.fn(),
}));

vi.mock("./supabase", () => ({
  getSupabase: () => ({
    storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove, createSignedUrl: mocks.createSignedUrl }) },
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { trip_id: "trip" }, error: null }) }) }) }) }),
  }),
}));
vi.mock("./auth", () => ({ currentUserId: vi.fn(async () => "user-1") }));
vi.mock("./repository", () => ({ updateParticipant: mocks.updateParticipant, addTripPhotoFromUpload: mocks.addTripPhoto, deleteTripPhoto: mocks.deleteTripPhoto }));

import { db } from "./database";
import { flushPhotoUploads, forgetSignedPhotoUrl, getSignedPhotoUrl, queueMemoryPhoto, removeParticipantPhoto, removeTripPhoto, uploadParticipantPhoto } from "./profile-photos";

const participant: Participant = {
  id: "participant-1", tripId: "11111111-1111-1111-1111-111111111111", name: "Romain", avatarUrl: null,
  colorIndex: 0, sortOrder: 0, userId: "user-1", bacEnabled: false, weightKg: null, distributionRatio: null, bacPrivate: false,
  createdAt: "2026-08-27T10:00:00Z", updatedAt: "2026-08-27T10:00:00Z", deletedAt: null,
};

beforeEach(async () => {
  await db.open(); await db.photoUploads.clear(); await db.settings.clear();
  mocks.upload.mockReset().mockResolvedValue({ error: null });
  mocks.remove.mockReset().mockResolvedValue({ error: null });
  mocks.createSignedUrl.mockReset().mockResolvedValue({ data: { signedUrl: "https://signed.test/photo-1" }, error: null });
  mocks.updateParticipant.mockReset().mockResolvedValue(undefined);
  mocks.addTripPhoto.mockReset().mockResolvedValue(undefined);
  mocks.deleteTripPhoto.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 3024, height: 4032, close: vi.fn() })));
  const original = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag !== "canvas") return original(tag);
    return { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }), toBlob: (callback: (blob: Blob) => void, type: string) => callback(new Blob(["optimized"], { type })) } as unknown as HTMLElement;
  }) as typeof document.createElement);
});

afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); await db.photoUploads.clear(); await db.settings.clear(); });

describe("photos iPhone", () => {
  it("accepte une sélection HEIC et la met en file hors ligne", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const file = new File(["heic"], "portrait.HEIC", { type: "image/heic", lastModified: Date.now() });
    await expect(uploadParticipantPhoto(participant, file)).resolves.toMatchObject({ status: "queued" });
    expect(await db.photoUploads.count()).toBe(1);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("refuse un format non-image et une source de plus de 25 Mo", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    await expect(uploadParticipantPhoto(participant, new File(["x"], "note.txt", { type: "text/plain" }))).rejects.toThrow("JPEG, PNG, WebP, HEIC ou HEIF");
    const huge = new File([new Uint8Array(25 * 1024 * 1024 + 1)], "huge.jpg", { type: "image/jpeg" });
    await expect(uploadParticipantPhoto(participant, huge)).rejects.toThrow("25 Mo");
  });

  it("conserve la photo dans la file avec l’erreur quand Storage échoue", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    mocks.upload.mockResolvedValue({ error: new Error("Storage indisponible") });
    await expect(uploadParticipantPhoto(participant, new File(["jpeg"], "photo.jpg", { type: "image/jpeg" }))).rejects.toThrow("Storage indisponible");
    expect((await db.photoUploads.toArray())[0]).toMatchObject({ status: "failed", lastError: "Storage indisponible" });
  });

  it("supprime la référence puis le fichier privé", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    await removeParticipantPhoto({ ...participant, avatarUrl: "storage:profile-photos/11111111-1111-1111-1111-111111111111/participant-1/avatar.webp" });
    expect(mocks.updateParticipant).toHaveBeenCalledWith(expect.objectContaining({ id: "participant-1" }), { avatarUrl: null });
    expect(mocks.remove).toHaveBeenCalledWith(["11111111-1111-1111-1111-111111111111/participant-1/avatar.webp"]);
  });

  it("reprend une photo souvenir hors ligne une seule fois après reconnexion", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const result = await queueMemoryPhoto(participant.tripId, new File(["jpeg"], "riad.jpg", { type: "image/jpeg" }), "2026-09-12T22:00:00.000Z");
    expect(result.status).toBe("queued");
    expect(await db.photoUploads.count()).toBe(1);

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    await flushPhotoUploads();
    await flushPhotoUploads();

    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.addTripPhoto).toHaveBeenCalledTimes(1);
    expect(mocks.addTripPhoto).toHaveBeenCalledWith(expect.objectContaining({ id: result.uploadId, tripId: participant.tripId }));
    expect(await db.photoUploads.count()).toBe(0);
  });

  it("redemande une URL signée après invalidation de la précédente", async () => {
    const path = `${participant.tripId}/souvenir.webp`;
    mocks.createSignedUrl
      .mockResolvedValueOnce({ data: { signedUrl: "https://signed.test/expired" }, error: null })
      .mockResolvedValueOnce({ data: { signedUrl: "https://signed.test/fresh" }, error: null });

    expect(await getSignedPhotoUrl("trip-photos", path)).toBe("https://signed.test/expired");
    expect(await getSignedPhotoUrl("trip-photos", path)).toBe("https://signed.test/expired");
    expect(mocks.createSignedUrl).toHaveBeenCalledTimes(1);
    forgetSignedPhotoUrl("trip-photos", path);
    expect(await getSignedPhotoUrl("trip-photos", path)).toBe("https://signed.test/fresh");
    expect(mocks.createSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("supprime d’abord la métadonnée du souvenir puis son objet Storage", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const photo: TripPhoto = {
      id: "photo-1", tripId: participant.tripId, storagePath: `${participant.tripId}/photo-1.webp`,
      takenAt: "2026-09-12T22:00:00.000Z", uploadedBy: "user-1", caption: null,
      createdAt: "2026-09-12T22:00:00.000Z", updatedAt: "2026-09-12T22:00:00.000Z", deletedAt: null,
    };

    await removeTripPhoto(photo);

    expect(mocks.deleteTripPhoto).toHaveBeenCalledWith(photo);
    expect(mocks.remove).toHaveBeenCalledWith([photo.storagePath]);
    expect(await db.settings.get("pendingPhotoDeletes")).toBeUndefined();
  });
});
