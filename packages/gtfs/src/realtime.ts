type WireValue =
  | {
      type: "bytes";
      value: Uint8Array;
    }
  | {
      type: "fixed32";
      value: number;
    }
  | {
      type: "fixed64";
      value: bigint;
    }
  | {
      type: "varint";
      value: bigint;
    };

interface ProtobufField {
  fieldNumber: number;
  value: WireValue;
}

interface ProtobufReader {
  offset: number;
  view: DataView;
}

export interface GtfsRealtimeTripDescriptor {
  directionId: number | null;
  routeId: string | null;
  startDate: string | null;
  startTime: string | null;
  tripId: string | null;
}

export interface GtfsRealtimeVehicleDescriptor {
  id: string | null;
  label: string | null;
  licensePlate: string | null;
}

export interface GtfsRealtimeTranslation {
  language: string | null;
  text: string;
}

export interface GtfsRealtimeTranslatedString {
  translations: GtfsRealtimeTranslation[];
}

export interface GtfsRealtimeLocalizedImage {
  language: string | null;
  mediaType: string | null;
  url: string;
}

export interface GtfsRealtimeTranslatedImage {
  localizedImages: GtfsRealtimeLocalizedImage[];
}

export interface GtfsRealtimePosition {
  bearing: number | null;
  lat: number;
  lon: number;
  speed: number | null;
}

export interface GtfsRealtimeVehiclePosition {
  currentStopSequence: number | null;
  id: string;
  position: GtfsRealtimePosition | null;
  stopId: string | null;
  timestamp: number | null;
  trip: GtfsRealtimeTripDescriptor | null;
  vehicle: GtfsRealtimeVehicleDescriptor | null;
}

export interface GtfsRealtimeStopTimeEvent {
  delaySeconds: number | null;
  time: number | null;
  uncertainty: number | null;
}

export interface GtfsRealtimeStopTimeUpdate {
  arrival: GtfsRealtimeStopTimeEvent | null;
  departure: GtfsRealtimeStopTimeEvent | null;
  stopId: string | null;
  stopSequence: number | null;
}

export interface GtfsRealtimeTripUpdate {
  id: string;
  stopTimeUpdates: GtfsRealtimeStopTimeUpdate[];
  timestamp: number | null;
  trip: GtfsRealtimeTripDescriptor | null;
  vehicle: GtfsRealtimeVehicleDescriptor | null;
}

export interface GtfsRealtimeTimeRange {
  end: number | null;
  start: number | null;
}

export interface GtfsRealtimeEntitySelector {
  agencyId: string | null;
  directionId: number | null;
  routeId: string | null;
  routeType: number | null;
  stopId: string | null;
  trip: GtfsRealtimeTripDescriptor | null;
}

export interface GtfsRealtimeAlert {
  activePeriods: GtfsRealtimeTimeRange[];
  cause: number | null;
  causeDetail: GtfsRealtimeTranslatedString | null;
  descriptionText: GtfsRealtimeTranslatedString | null;
  effect: number | null;
  effectDetail: GtfsRealtimeTranslatedString | null;
  headerText: GtfsRealtimeTranslatedString | null;
  id: string;
  image: GtfsRealtimeTranslatedImage | null;
  imageAlternativeText: GtfsRealtimeTranslatedString | null;
  informedEntities: GtfsRealtimeEntitySelector[];
  isDeleted: boolean;
  severityLevel: number | null;
  ttsDescriptionText: GtfsRealtimeTranslatedString | null;
  ttsHeaderText: GtfsRealtimeTranslatedString | null;
  url: GtfsRealtimeTranslatedString | null;
}

export interface GtfsRealtimeFeedMetadata {
  feedVersion: string | null;
  incrementality: number | null;
  timestamp: number | null;
}

function createReader(bytes: Uint8Array): ProtobufReader {
  return {
    offset: 0,
    view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
  };
}

function readVarint(reader: ProtobufReader) {
  let shift = 0n;
  let value = 0n;

  while (reader.offset < reader.view.byteLength) {
    const byte = reader.view.getUint8(reader.offset);
    reader.offset += 1;
    value |= BigInt(byte & 0x7f) << shift;

    if ((byte & 0x80) === 0) {
      return value;
    }

    shift += 7n;
  }

  throw new Error("Unexpected end of GTFS-RT varint");
}

function readBytes(reader: ProtobufReader) {
  const length = Number(readVarint(reader));
  const start = reader.offset;
  const end = start + length;

  if (end > reader.view.byteLength) {
    throw new Error("Unexpected end of GTFS-RT length-delimited field");
  }

  reader.offset = end;

  return new Uint8Array(reader.view.buffer, reader.view.byteOffset + start, length);
}

function readField(reader: ProtobufReader): ProtobufField | null {
  if (reader.offset >= reader.view.byteLength) {
    return null;
  }

  const tag = Number(readVarint(reader));
  const fieldNumber = tag >> 3;
  const wireType = tag & 0x07;

  switch (wireType) {
    case 0:
      return {
        fieldNumber,
        value: { type: "varint", value: readVarint(reader) },
      };
    case 1: {
      const value = reader.view.getBigUint64(reader.offset, true);
      reader.offset += 8;

      return { fieldNumber, value: { type: "fixed64", value } };
    }
    case 2:
      return {
        fieldNumber,
        value: { type: "bytes", value: readBytes(reader) },
      };
    case 5: {
      const value = reader.view.getUint32(reader.offset, true);
      reader.offset += 4;

      return { fieldNumber, value: { type: "fixed32", value } };
    }
    default:
      throw new Error(`Unsupported GTFS-RT protobuf wire type ${wireType}`);
  }
}

function readFields(bytes: Uint8Array) {
  const reader = createReader(bytes);
  const fields: ProtobufField[] = [];

  while (reader.offset < reader.view.byteLength) {
    const field = readField(reader);

    if (field) {
      fields.push(field);
    }
  }

  return fields;
}

function getBytes(field: ProtobufField) {
  return field.value.type === "bytes" ? field.value.value : null;
}

function getNumber(field: ProtobufField) {
  return field.value.type === "varint" ? Number(field.value.value) : null;
}

function getBoolean(field: ProtobufField) {
  return field.value.type === "varint" ? field.value.value !== 0n : null;
}

function getSignedInt32(field: ProtobufField) {
  return field.value.type === "varint"
    ? Number(BigInt.asIntN(32, field.value.value))
    : null;
}

function getString(field: ProtobufField) {
  const bytes = getBytes(field);

  return bytes ? new TextDecoder().decode(bytes) : null;
}

function getFloat(field: ProtobufField) {
  if (field.value.type !== "fixed32") {
    return null;
  }

  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, field.value.value, true);

  return view.getFloat32(0, true);
}

function parseTripDescriptor(bytes: Uint8Array): GtfsRealtimeTripDescriptor {
  const descriptor: GtfsRealtimeTripDescriptor = {
    directionId: null,
    routeId: null,
    startDate: null,
    startTime: null,
    tripId: null,
  };

  for (const field of readFields(bytes)) {
    if (field.fieldNumber === 1) {
      descriptor.tripId = getString(field);
    } else if (field.fieldNumber === 2) {
      descriptor.startTime = getString(field);
    } else if (field.fieldNumber === 3) {
      descriptor.startDate = getString(field);
    } else if (field.fieldNumber === 5) {
      descriptor.routeId = getString(field);
    } else if (field.fieldNumber === 6) {
      descriptor.directionId = getNumber(field);
    }
  }

  return descriptor;
}

function parseVehicleDescriptor(
  bytes: Uint8Array,
): GtfsRealtimeVehicleDescriptor {
  const descriptor: GtfsRealtimeVehicleDescriptor = {
    id: null,
    label: null,
    licensePlate: null,
  };

  for (const field of readFields(bytes)) {
    if (field.fieldNumber === 1) {
      descriptor.id = getString(field);
    } else if (field.fieldNumber === 2) {
      descriptor.label = getString(field);
    } else if (field.fieldNumber === 3) {
      descriptor.licensePlate = getString(field);
    }
  }

  return descriptor;
}

function parseTranslatedString(
  bytes: Uint8Array,
): GtfsRealtimeTranslatedString | null {
  const translatedString: GtfsRealtimeTranslatedString = {
    translations: [],
  };

  for (const field of readFields(bytes)) {
    const nestedBytes = getBytes(field);

    if (field.fieldNumber === 1 && nestedBytes) {
      const translation: GtfsRealtimeTranslation = {
        language: null,
        text: "",
      };

      for (const translationField of readFields(nestedBytes)) {
        if (translationField.fieldNumber === 1) {
          translation.text = getString(translationField) ?? "";
        } else if (translationField.fieldNumber === 2) {
          translation.language = getString(translationField);
        }
      }

      if (translation.text) {
        translatedString.translations.push(translation);
      }
    }
  }

  return translatedString.translations.length > 0 ? translatedString : null;
}

function parseTranslatedImage(
  bytes: Uint8Array,
): GtfsRealtimeTranslatedImage | null {
  const translatedImage: GtfsRealtimeTranslatedImage = {
    localizedImages: [],
  };

  for (const field of readFields(bytes)) {
    const nestedBytes = getBytes(field);

    if (field.fieldNumber === 1 && nestedBytes) {
      const image: GtfsRealtimeLocalizedImage = {
        language: null,
        mediaType: null,
        url: "",
      };

      for (const imageField of readFields(nestedBytes)) {
        if (imageField.fieldNumber === 1) {
          image.url = getString(imageField) ?? "";
        } else if (imageField.fieldNumber === 2) {
          image.mediaType = getString(imageField);
        } else if (imageField.fieldNumber === 3) {
          image.language = getString(imageField);
        }
      }

      if (image.url) {
        translatedImage.localizedImages.push(image);
      }
    }
  }

  return translatedImage.localizedImages.length > 0 ? translatedImage : null;
}

function parsePosition(bytes: Uint8Array): GtfsRealtimePosition | null {
  const position: GtfsRealtimePosition = {
    bearing: null,
    lat: Number.NaN,
    lon: Number.NaN,
    speed: null,
  };

  for (const field of readFields(bytes)) {
    if (field.fieldNumber === 1) {
      position.lat = getFloat(field) ?? Number.NaN;
    } else if (field.fieldNumber === 2) {
      position.lon = getFloat(field) ?? Number.NaN;
    } else if (field.fieldNumber === 3) {
      position.bearing = getFloat(field);
    } else if (field.fieldNumber === 5) {
      position.speed = getFloat(field);
    }
  }

  return Number.isFinite(position.lat) && Number.isFinite(position.lon)
    ? position
    : null;
}

function parseStopTimeEvent(bytes: Uint8Array): GtfsRealtimeStopTimeEvent {
  const event: GtfsRealtimeStopTimeEvent = {
    delaySeconds: null,
    time: null,
    uncertainty: null,
  };

  for (const field of readFields(bytes)) {
    if (field.fieldNumber === 1) {
      event.delaySeconds = getSignedInt32(field);
    } else if (field.fieldNumber === 2) {
      event.time = getNumber(field);
    } else if (field.fieldNumber === 3) {
      event.uncertainty = getSignedInt32(field);
    }
  }

  return event;
}

function parseStopTimeUpdate(bytes: Uint8Array): GtfsRealtimeStopTimeUpdate {
  const update: GtfsRealtimeStopTimeUpdate = {
    arrival: null,
    departure: null,
    stopId: null,
    stopSequence: null,
  };

  for (const field of readFields(bytes)) {
    const nestedBytes = getBytes(field);

    if (field.fieldNumber === 1) {
      update.stopSequence = getNumber(field);
    } else if (field.fieldNumber === 2 && nestedBytes) {
      update.arrival = parseStopTimeEvent(nestedBytes);
    } else if (field.fieldNumber === 3 && nestedBytes) {
      update.departure = parseStopTimeEvent(nestedBytes);
    } else if (field.fieldNumber === 4) {
      update.stopId = getString(field);
    }
  }

  return update;
}

function parseVehiclePosition(
  id: string,
  bytes: Uint8Array,
): GtfsRealtimeVehiclePosition {
  const vehiclePosition: GtfsRealtimeVehiclePosition = {
    currentStopSequence: null,
    id,
    position: null,
    stopId: null,
    timestamp: null,
    trip: null,
    vehicle: null,
  };

  for (const field of readFields(bytes)) {
    const nestedBytes = getBytes(field);

    if (field.fieldNumber === 1 && nestedBytes) {
      vehiclePosition.trip = parseTripDescriptor(nestedBytes);
    } else if (field.fieldNumber === 2 && nestedBytes) {
      vehiclePosition.position = parsePosition(nestedBytes);
    } else if (field.fieldNumber === 3) {
      vehiclePosition.currentStopSequence = getNumber(field);
    } else if (field.fieldNumber === 5) {
      vehiclePosition.timestamp = getNumber(field);
    } else if (field.fieldNumber === 7) {
      vehiclePosition.stopId = getString(field);
    } else if (field.fieldNumber === 8 && nestedBytes) {
      vehiclePosition.vehicle = parseVehicleDescriptor(nestedBytes);
    }
  }

  return vehiclePosition;
}

function parseTripUpdate(id: string, bytes: Uint8Array): GtfsRealtimeTripUpdate {
  const tripUpdate: GtfsRealtimeTripUpdate = {
    id,
    stopTimeUpdates: [],
    timestamp: null,
    trip: null,
    vehicle: null,
  };

  for (const field of readFields(bytes)) {
    const nestedBytes = getBytes(field);

    if (field.fieldNumber === 1 && nestedBytes) {
      tripUpdate.trip = parseTripDescriptor(nestedBytes);
    } else if (field.fieldNumber === 2 && nestedBytes) {
      tripUpdate.stopTimeUpdates.push(parseStopTimeUpdate(nestedBytes));
    } else if (field.fieldNumber === 3 && nestedBytes) {
      tripUpdate.vehicle = parseVehicleDescriptor(nestedBytes);
    } else if (field.fieldNumber === 4) {
      tripUpdate.timestamp = getNumber(field);
    }
  }

  return tripUpdate;
}

function parseTimeRange(bytes: Uint8Array): GtfsRealtimeTimeRange {
  const timeRange: GtfsRealtimeTimeRange = {
    end: null,
    start: null,
  };

  for (const field of readFields(bytes)) {
    if (field.fieldNumber === 1) {
      timeRange.start = getNumber(field);
    } else if (field.fieldNumber === 2) {
      timeRange.end = getNumber(field);
    }
  }

  return timeRange;
}

function parseEntitySelector(bytes: Uint8Array): GtfsRealtimeEntitySelector {
  const selector: GtfsRealtimeEntitySelector = {
    agencyId: null,
    directionId: null,
    routeId: null,
    routeType: null,
    stopId: null,
    trip: null,
  };

  for (const field of readFields(bytes)) {
    const nestedBytes = getBytes(field);

    if (field.fieldNumber === 1) {
      selector.agencyId = getString(field);
    } else if (field.fieldNumber === 2) {
      selector.routeId = getString(field);
    } else if (field.fieldNumber === 3) {
      selector.routeType = getSignedInt32(field);
    } else if (field.fieldNumber === 4 && nestedBytes) {
      selector.trip = parseTripDescriptor(nestedBytes);
    } else if (field.fieldNumber === 5) {
      selector.stopId = getString(field);
    } else if (field.fieldNumber === 6) {
      selector.directionId = getNumber(field);
    }
  }

  return selector;
}

function parseAlert(
  id: string,
  isDeleted: boolean,
  bytes: Uint8Array,
): GtfsRealtimeAlert {
  const alert: GtfsRealtimeAlert = {
    activePeriods: [],
    cause: null,
    causeDetail: null,
    descriptionText: null,
    effect: null,
    effectDetail: null,
    headerText: null,
    id,
    image: null,
    imageAlternativeText: null,
    informedEntities: [],
    isDeleted,
    severityLevel: null,
    ttsDescriptionText: null,
    ttsHeaderText: null,
    url: null,
  };

  for (const field of readFields(bytes)) {
    const nestedBytes = getBytes(field);

    if (field.fieldNumber === 1 && nestedBytes) {
      alert.activePeriods.push(parseTimeRange(nestedBytes));
    } else if (field.fieldNumber === 5 && nestedBytes) {
      alert.informedEntities.push(parseEntitySelector(nestedBytes));
    } else if (field.fieldNumber === 6) {
      alert.cause = getNumber(field);
    } else if (field.fieldNumber === 7) {
      alert.effect = getNumber(field);
    } else if (field.fieldNumber === 8 && nestedBytes) {
      alert.url = parseTranslatedString(nestedBytes);
    } else if (field.fieldNumber === 10 && nestedBytes) {
      alert.headerText = parseTranslatedString(nestedBytes);
    } else if (field.fieldNumber === 11 && nestedBytes) {
      alert.descriptionText = parseTranslatedString(nestedBytes);
    } else if (field.fieldNumber === 12 && nestedBytes) {
      alert.ttsHeaderText = parseTranslatedString(nestedBytes);
    } else if (field.fieldNumber === 13 && nestedBytes) {
      alert.ttsDescriptionText = parseTranslatedString(nestedBytes);
    } else if (field.fieldNumber === 14) {
      alert.severityLevel = getNumber(field);
    } else if (field.fieldNumber === 15 && nestedBytes) {
      alert.image = parseTranslatedImage(nestedBytes);
    } else if (field.fieldNumber === 16 && nestedBytes) {
      alert.imageAlternativeText = parseTranslatedString(nestedBytes);
    } else if (field.fieldNumber === 17 && nestedBytes) {
      alert.causeDetail = parseTranslatedString(nestedBytes);
    } else if (field.fieldNumber === 18 && nestedBytes) {
      alert.effectDetail = parseTranslatedString(nestedBytes);
    }
  }

  return alert;
}

function parseFeedEntities(bytes: Uint8Array) {
  const entities: {
    alert?: Uint8Array;
    id: string;
    isDeleted: boolean;
    tripUpdate?: Uint8Array;
    vehicle?: Uint8Array;
  }[] = [];

  for (const feedField of readFields(bytes)) {
    if (feedField.fieldNumber !== 2) {
      continue;
    }

    const entityBytes = getBytes(feedField);

    if (!entityBytes) {
      continue;
    }

    const entity: {
      alert?: Uint8Array;
      id: string;
      isDeleted: boolean;
      tripUpdate?: Uint8Array;
      vehicle?: Uint8Array;
    } = { id: "", isDeleted: false };

    for (const entityField of readFields(entityBytes)) {
      if (entityField.fieldNumber === 1) {
        entity.id = getString(entityField) ?? "";
      } else if (entityField.fieldNumber === 2) {
        entity.isDeleted = getBoolean(entityField) ?? false;
      } else if (entityField.fieldNumber === 3) {
        entity.tripUpdate = getBytes(entityField) ?? undefined;
      } else if (entityField.fieldNumber === 4) {
        entity.vehicle = getBytes(entityField) ?? undefined;
      } else if (entityField.fieldNumber === 5) {
        entity.alert = getBytes(entityField) ?? undefined;
      }
    }

    entities.push(entity);
  }

  return entities;
}

export function parseGtfsRealtimeVehiclePositions(
  payload: Uint8Array,
): GtfsRealtimeVehiclePosition[] {
  const vehiclePositions: GtfsRealtimeVehiclePosition[] = [];

  for (const entity of parseFeedEntities(payload)) {
    if (entity.vehicle) {
      vehiclePositions.push(parseVehiclePosition(entity.id, entity.vehicle));
    }
  }

  return vehiclePositions;
}

export function parseGtfsRealtimeTripUpdates(
  payload: Uint8Array,
): GtfsRealtimeTripUpdate[] {
  const tripUpdates: GtfsRealtimeTripUpdate[] = [];

  for (const entity of parseFeedEntities(payload)) {
    if (entity.tripUpdate) {
      tripUpdates.push(parseTripUpdate(entity.id, entity.tripUpdate));
    }
  }

  return tripUpdates;
}

export function parseGtfsRealtimeAlerts(
  payload: Uint8Array,
): GtfsRealtimeAlert[] {
  const alerts: GtfsRealtimeAlert[] = [];

  for (const entity of parseFeedEntities(payload)) {
    if (entity.alert) {
      alerts.push(parseAlert(entity.id, entity.isDeleted, entity.alert));
    } else if (entity.isDeleted) {
      alerts.push(parseAlert(entity.id, true, new Uint8Array()));
    }
  }

  return alerts;
}

export function parseGtfsRealtimeFeedMetadata(
  payload: Uint8Array,
): GtfsRealtimeFeedMetadata {
  const metadata: GtfsRealtimeFeedMetadata = {
    feedVersion: null,
    incrementality: null,
    timestamp: null,
  };

  for (const feedField of readFields(payload)) {
    if (feedField.fieldNumber !== 1) {
      continue;
    }

    const headerBytes = getBytes(feedField);

    if (!headerBytes) {
      continue;
    }

    for (const headerField of readFields(headerBytes)) {
      if (headerField.fieldNumber === 2) {
        metadata.incrementality = getNumber(headerField);
      } else if (headerField.fieldNumber === 3) {
        metadata.timestamp = getNumber(headerField);
      } else if (headerField.fieldNumber === 4) {
        metadata.feedVersion = getString(headerField);
      }
    }
  }

  return metadata;
}
