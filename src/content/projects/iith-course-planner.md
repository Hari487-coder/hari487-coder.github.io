---
title: IITH Course Planner
summary: Single-file registration planner for the EM M.Tech, pick courses, see your week, catch slot clashes before the portal does.
stack: [JavaScript, HTML, CSS]
status: building
icon: lucide:calendar-days
date: 2026-07-20
---

Course registration at IITH means cross-referencing the curriculum page, the live course
list, and the official slot grid, then hoping your picks do not clash. The planner folds
all three into one page for the M.Tech Techno-Entrepreneurship program.

Pick courses and it renders your actual week on the IITH slot grid, flags timetable
clashes instantly, tracks credit requirements per group (core, department electives,
engineering elective), and prints the exact rows to type into the registration form.

Built first for my own Semester 1 load: [[em5090]], [[em5110]], and [[em5270]].

One HTML file, no dependencies, no build step, no server. Course data is verified against
the live registration system, including which courses are actually registerable this term
versus merely listed. Built for the Jul-Nov 2026 semester; sharing with the cohort once
the term's data settles.
