// Google Classroom: everything assigned to me that I have not turned in,
// across active courses, fetched directly from the browser.

export interface PendingItem {
  id: string;
  courseName: string;
  title: string;
  due: Date | null;
  points: number | null;
  link: string;
}

export class AuthError extends Error {}
export class ApiDisabledError extends Error {}

const BASE = 'https://classroom.googleapis.com/v1';

async function api(token: string, path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new AuthError('unauthorized');
  if (res.status === 403) throw new ApiDisabledError('forbidden');
  if (!res.ok) throw new Error(`Classroom API ${res.status}`);
  return res.json();
}

const PENDING_STATES = new Set(['NEW', 'CREATED', 'RECLAIMED_BY_STUDENT']);

function toDue(work: any): Date | null {
  const d = work.dueDate;
  if (!d?.year) return null;
  // Classroom dueTime is UTC; combine and let the browser render locally.
  const t = work.dueTime ?? {};
  return new Date(Date.UTC(d.year, (d.month ?? 1) - 1, d.day ?? 1, t.hours ?? 23, t.minutes ?? 59));
}

export async function fetchPending(token: string): Promise<PendingItem[]> {
  const coursesRes = await api(token, '/courses?courseStates=ACTIVE&pageSize=50');
  const courses: any[] = coursesRes.courses ?? [];

  const perCourse = await Promise.all(
    courses.map(async (course) => {
      const [workRes, subsRes] = await Promise.all([
        api(token, `/courses/${course.id}/courseWork?pageSize=200`),
        api(token, `/courses/${course.id}/courseWork/-/studentSubmissions?userId=me&pageSize=200`),
      ]);
      const work: any[] = workRes.courseWork ?? [];
      const subs: any[] = subsRes.studentSubmissions ?? [];
      const workById = new Map(work.map((w) => [w.id, w]));

      return subs
        .filter((s) => PENDING_STATES.has(s.state))
        .map((s) => {
          const w = workById.get(s.courseWorkId);
          if (!w) return null;
          return {
            id: `${course.id}/${w.id}`,
            courseName: course.name ?? 'Course',
            title: w.title ?? 'Untitled work',
            due: toDue(w),
            points: typeof w.maxPoints === 'number' ? w.maxPoints : null,
            link: w.alternateLink ?? course.alternateLink ?? 'https://classroom.google.com',
          } satisfies PendingItem;
        })
        .filter((x): x is PendingItem => x !== null);
    }),
  );

  return perCourse.flat().sort((a, b) => {
    if (a.due && b.due) return a.due.getTime() - b.due.getTime();
    if (a.due) return -1;
    if (b.due) return 1;
    return a.title.localeCompare(b.title);
  });
}
