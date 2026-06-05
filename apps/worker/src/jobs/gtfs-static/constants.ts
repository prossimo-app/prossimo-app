export const REQUIRED_ROUTE_COLUMNS = ["route_id", "route_type"] as const;
export const REQUIRED_AGENCY_COLUMNS = ["agency_id", "agency_name"] as const;
export const REQUIRED_CALENDAR_COLUMNS = [
  "service_id",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "start_date",
  "end_date",
] as const;
export const REQUIRED_CALENDAR_DATE_COLUMNS = [
  "service_id",
  "date",
  "exception_type",
] as const;
export const REQUIRED_SHAPE_COLUMNS = [
  "shape_id",
  "shape_pt_lat",
  "shape_pt_lon",
  "shape_pt_sequence",
] as const;
export const REQUIRED_STOP_COLUMNS = [
  "stop_id",
  "stop_name",
  "stop_lat",
  "stop_lon",
] as const;
export const REQUIRED_STOP_TIME_COLUMNS = [
  "trip_id",
  "stop_id",
  "stop_sequence",
] as const;
export const REQUIRED_TRIP_COLUMNS = ["trip_id", "route_id", "service_id"] as const;
export const ROUTE_TYPES = new Set([0, 1, 2, 3]);
export const INSERT_BATCH_SIZE = 250;
