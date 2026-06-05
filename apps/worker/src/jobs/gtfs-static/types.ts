export interface ParsedAgency {
  agencyId: string;
  agencyLang: string | null;
  agencyName: string;
  agencyPhone: string | null;
  agencyTimezone: string | null;
  agencyUrl: string | null;
}

export interface ParsedCalendar {
  endDate: string;
  friday: boolean;
  monday: boolean;
  saturday: boolean;
  serviceId: string;
  startDate: string;
  sunday: boolean;
  thursday: boolean;
  tuesday: boolean;
  wednesday: boolean;
}

export interface ParsedCalendarDate {
  date: string;
  exceptionType: number;
  serviceId: string;
}

export interface ParsedRoute {
  agencyId: string | null;
  routeColor: string | null;
  routeDesc: string | null;
  routeId: string;
  routeLongName: string | null;
  routeShortName: string | null;
  routeTextColor: string | null;
  routeType: number;
  routeUrl: string | null;
}

export interface ParsedShape {
  shapeDistTraveled: number | null;
  shapeId: string;
  shapePtLat: number;
  shapePtLon: number;
  shapePtSequence: number;
}

export interface ParsedStop {
  locationType: number | null;
  parentStation: string | null;
  stopCode: string | null;
  stopDesc: string | null;
  stopId: string;
  stopLat: number;
  stopLon: number;
  stopName: string;
  stopUrl: string | null;
  wheelchairBoarding: number | null;
  zoneId: string | null;
}

export interface ParsedStopTime {
  arrivalSeconds: number | null;
  arrivalTime: string | null;
  departureSeconds: number | null;
  departureTime: string | null;
  dropOffType: number | null;
  pickupType: number | null;
  shapeDistTraveled: number | null;
  stopHeadsign: string | null;
  stopId: string;
  stopSequence: number;
  timepoint: number | null;
  tripId: string;
}

export interface ParsedTrip {
  bikesAllowed: number | null;
  blockId: string | null;
  directionId: number | null;
  routeId: string;
  serviceId: string;
  shapeId: string | null;
  tripHeadsign: string | null;
  tripId: string;
  tripShortName: string | null;
  wheelchairAccessible: number | null;
}
