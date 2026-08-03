// The IITH slot grid for Jul-Nov 2026.
//
// Ported from the iith-course-planner project, where the slots were taken from
// the 25 departmental timetables at iith.ac.in/academics/calendars-timetables
// and cross-checked against live AIMS records. Do not edit by hand for a new
// term: re-derive from the published timetables, as that project documents.

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

/** Every start time used by the grid, in order. */
export const PERIODS = ['09:00', '10:00', '11:00', '12:00', '14:30', '16:00'] as const;

/** Start time -> end time. Morning periods run 55 minutes, afternoon ones 85. */
export const ENDS: Record<string, string> = {
  '09:00': '09:55',
  '10:00': '10:55',
  '11:00': '11:55',
  '12:00': '12:55',
  '14:30': '15:55',
  '16:00': '17:25',
};

/** Slot letter -> [dayIndex (0 = Mon), start time]. */
export const SLOTS: Record<string, [number, string][]> = {
  A: [[0, '09:00'], [2, '11:00'], [3, '10:00']],
  B: [[0, '10:00'], [2, '09:00'], [3, '11:00']],
  C: [[0, '11:00'], [2, '10:00'], [3, '09:00']],
  D: [[0, '12:00'], [1, '09:00'], [4, '11:00']],
  E: [[1, '10:00'], [3, '12:00'], [4, '09:00']],
  F: [[1, '11:00'], [4, '10:00'], [2, '14:30']],
  G: [[1, '12:00'], [2, '12:00'], [4, '12:00']],
  P: [[0, '14:30'], [3, '16:00']],
  Q: [[0, '16:00'], [3, '14:30']],
  R: [[1, '14:30'], [4, '16:00']],
  S: [[1, '16:00'], [4, '14:30']],
};

/** Semester dates, for the calendar export. */
export const TERM = {
  /** First occurrence of each weekday in the term, YYYYMMDD. */
  firstDate: ['20260727', '20260728', '20260729', '20260730', '20260731'],
  /** Last instant of the teaching term, UTC basic format. */
  end: '20261113T235959',
};

export interface Meeting {
  day: number;
  start: string;
  end: string;
}

export function meetingsFor(slot: string | undefined): Meeting[] {
  if (!slot || !SLOTS[slot]) return [];
  return SLOTS[slot].map(([day, start]) => ({ day, start, end: ENDS[start] ?? start }));
}
