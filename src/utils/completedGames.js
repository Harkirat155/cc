export const normalizeSequenceStrings = (sequenceStrings = []) => {
  if (!Array.isArray(sequenceStrings)) return [];
  return sequenceStrings
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
};

export const createCompletedGameSignature = (
  sequenceStrings = [],
  lastMoveTimestamp = null
) => {
  const seq = normalizeSequenceStrings(sequenceStrings).join("-");
  const timestampPart = Number.isFinite(lastMoveTimestamp)
    ? String(lastMoveTimestamp)
    : "none";
  return `${seq}::${timestampPart}`;
};

export const shouldArchiveCompletedGame = ({
  lastSignature = null,
  sequenceStrings = [],
  lastMoveTimestamp = null,
} = {}) => {
  const normalizedSequence = normalizeSequenceStrings(sequenceStrings);
  const signature = createCompletedGameSignature(
    normalizedSequence,
    lastMoveTimestamp
  );

  if (normalizedSequence.length === 0) {
    return { shouldArchive: false, signature };
  }

  if (lastSignature && signature === lastSignature) {
    return { shouldArchive: false, signature };
  }

  return { shouldArchive: true, signature };
};
