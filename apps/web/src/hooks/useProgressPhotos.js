import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const BUCKET = 'progress-photos';

// Path format: {user_id}/{date}/{angle}.jpg  (matches storage RLS folder structure)
function storagePath(userId, date, angle) {
  return `${userId}/${date}/${angle}.jpg`;
}

export function useProgressPhotos(userId) {
  // per-angle upload progress and error state
  const [uploading, setUploading] = useState({});
  const [errors, setErrors]       = useState({});

  const setAngleUploading = (angle, val) =>
    setUploading(u => ({ ...u, [angle]: val }));
  const setAngleError = (angle, val) =>
    setErrors(e => ({ ...e, [angle]: val }));

  // Generate a 1-hour signed URL for a stored path; returns null on error or missing path.
  const getSignedUrl = useCallback(async (path) => {
    if (!path) return null;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);
    if (error) return null;
    return data.signedUrl;
  }, []);

  // Upload file to storage and save path in biometric_entries.
  // Returns { success, path } or { error }.
  const uploadPhoto = useCallback(async (file, angle, date) => {
    if (!userId) return { error: 'Not authenticated' };
    if (file.size > 10 * 1024 * 1024) return { error: 'File too large (max 10MB)' };

    const path = storagePath(userId, date, angle);
    setAngleUploading(angle, true);
    setAngleError(angle, null);

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadErr) {
      setAngleUploading(angle, false);
      setAngleError(angle, 'Upload failed — try again');
      return { error: uploadErr.message };
    }

    // Save storage path (not signed URL) to biometric_entries
    const col = `photo_${angle}_url`;
    const { error: dbErr } = await supabase
      .from('biometric_entries')
      .upsert(
        { user_id: userId, logged_at: date, [col]: path },
        { onConflict: 'user_id,logged_at' }
      );

    setAngleUploading(angle, false);
    if (dbErr) {
      setAngleError(angle, 'Save failed — try again');
      return { error: dbErr.message };
    }

    return { success: true, path };
  }, [userId]);

  // Remove photo from storage and null the column in biometric_entries.
  const deletePhoto = useCallback(async (angle, date) => {
    if (!userId) return { error: 'Not authenticated' };
    const path = storagePath(userId, date, angle);

    // Best-effort storage removal (don't block on storage error)
    await supabase.storage.from(BUCKET).remove([path]);

    const col = `photo_${angle}_url`;
    const { error: dbErr } = await supabase
      .from('biometric_entries')
      .update({ [col]: null })
      .eq('user_id', userId)
      .eq('logged_at', date);

    if (dbErr) return { error: dbErr.message };
    return { success: true };
  }, [userId]);

  // Fetch stored paths for a date and return signed URLs for all three angles.
  const getPhotosForDate = useCallback(async (date) => {
    if (!userId || !date) return { front: null, side: null, back: null, paths: {} };

    const { data, error } = await supabase
      .from('biometric_entries')
      .select('photo_front_url, photo_side_url, photo_back_url')
      .eq('user_id', userId)
      .eq('logged_at', date)
      .single();

    if (error || !data) return { front: null, side: null, back: null, paths: {} };

    const [front, side, back] = await Promise.all([
      getSignedUrl(data.photo_front_url),
      getSignedUrl(data.photo_side_url),
      getSignedUrl(data.photo_back_url),
    ]);

    return {
      front, side, back,
      paths: {
        front: data.photo_front_url ?? null,
        side:  data.photo_side_url  ?? null,
        back:  data.photo_back_url  ?? null,
      },
    };
  }, [userId, getSignedUrl]);

  // Convenience: fetch signed URLs for two dates for the comparison view.
  const getComparisonPhotos = useCallback(async (beforeDate, afterDate) => {
    const [before, after] = await Promise.all([
      getPhotosForDate(beforeDate),
      getPhotosForDate(afterDate),
    ]);
    return { before, after };
  }, [getPhotosForDate]);

  return {
    uploading,
    errors,
    uploadPhoto,
    deletePhoto,
    getSignedUrl,
    getPhotosForDate,
    getComparisonPhotos,
  };
}
