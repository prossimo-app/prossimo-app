import { inflateRawSync } from "node:zlib";

interface ZipEntry {
  compressedSize: number;
  compressionMethod: number;
  name: string;
  offset: number;
  uncompressedSize: number;
}

export interface TextZipEntry {
  contents: string;
  name: string;
}

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x0605_4b50;
const CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE = 0x0201_4b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x0403_4b50;
const ZIP64_SIZE_MARKER = 0xffff_ffff;
const ZIP64_ENTRY_COUNT_MARKER = 0xffff;
const MAX_END_OF_CENTRAL_DIRECTORY_SEARCH_BYTES = 65_557;

function findEndOfCentralDirectory(buffer: Buffer) {
  const searchStart = Math.max(
    0,
    buffer.length - MAX_END_OF_CENTRAL_DIRECTORY_SEARCH_BYTES,
  );

  for (let offset = buffer.length - 22; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }

  throw new Error("Could not find ZIP end of central directory");
}

function readCentralDirectoryEntries(buffer: Buffer) {
  const endOfCentralDirectoryOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOfCentralDirectoryOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(
    endOfCentralDirectoryOffset + 16,
  );

  if (
    entryCount === ZIP64_ENTRY_COUNT_MARKER ||
    centralDirectoryOffset === ZIP64_SIZE_MARKER
  ) {
    throw new Error("ZIP64 archives are not supported");
  }

  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (
      buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE
    ) {
      throw new Error("Invalid ZIP central directory file header");
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const name = buffer.toString("utf8", fileNameStart, fileNameEnd);

    if (
      compressedSize === ZIP64_SIZE_MARKER ||
      uncompressedSize === ZIP64_SIZE_MARKER ||
      localHeaderOffset === ZIP64_SIZE_MARKER
    ) {
      throw new Error(`ZIP64 entry "${name}" is not supported`);
    }

    entries.push({
      compressedSize,
      compressionMethod,
      name,
      offset: localHeaderOffset,
      uncompressedSize,
    });

    offset = fileNameEnd + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function readEntryData(buffer: Buffer, entry: ZipEntry) {
  if (buffer.readUInt32LE(entry.offset) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error(`Invalid ZIP local file header for "${entry.name}"`);
  }

  const fileNameLength = buffer.readUInt16LE(entry.offset + 26);
  const extraFieldLength = buffer.readUInt16LE(entry.offset + 28);
  const dataStart = entry.offset + 30 + fileNameLength + extraFieldLength;
  const dataEnd = dataStart + entry.compressedSize;
  const compressedData = buffer.subarray(dataStart, dataEnd);

  if (entry.compressionMethod === 0) {
    return compressedData;
  }

  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressedData, {
      finishFlush: 2,
    });
  }

  throw new Error(
    `Unsupported compression method ${entry.compressionMethod} for "${entry.name}"`,
  );
}

export function readTextEntriesFromZip(
  buffer: Buffer,
  entryNames: readonly string[],
) {
  const requestedNames = new Set(entryNames);
  const entries = readCentralDirectoryEntries(buffer);
  const textEntries: TextZipEntry[] = [];

  for (const entry of entries) {
    if (!requestedNames.has(entry.name)) {
      continue;
    }

    const data = readEntryData(buffer, entry);

    if (data.length !== entry.uncompressedSize) {
      throw new Error(
        `Unexpected uncompressed size for "${entry.name}": expected ${entry.uncompressedSize}, got ${data.length}`,
      );
    }

    textEntries.push({
      contents: data.toString("utf8"),
      name: entry.name,
    });
  }

  return textEntries;
}
