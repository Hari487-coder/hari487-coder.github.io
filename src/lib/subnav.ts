// Sub-navigation for the paired pages inside IIT manager.
//
// Each pair is one sidebar item with tabs across the top, so the sidebar stays
// short while every page keeps its own route and its own build.

export interface Tab {
  key: string;
  label: string;
  href: string;
  icon: string;
}

/** Notes and the two ways of capturing them. */
export const NOTE_TABS: Tab[] = [
  { key: 'notes', label: 'All notes', href: '/notes/', icon: 'lucide:notebook-pen' },
  { key: 'record', label: 'Record live', href: '/iith/capture/', icon: 'lucide:mic' },
  { key: 'import', label: 'Import files', href: '/iith/capture/import/', icon: 'lucide:file-up' },
];

/** What I am taking, and when it meets. */
export const COURSE_TABS: Tab[] = [
  { key: 'courses', label: 'Courses', href: '/iith/', icon: 'lucide:graduation-cap' },
  { key: 'timetable', label: 'Timetable', href: '/iith/timetable/', icon: 'lucide:calendar-days' },
];

/** What is owed, from my own tracker and from Classroom. */
export const WORK_TABS: Tab[] = [
  { key: 'assignments', label: 'Assignments', href: '/iith/assignments/', icon: 'lucide:list-checks' },
  { key: 'classroom', label: 'Classroom', href: '/iith/inbox/', icon: 'lucide:inbox' },
];
