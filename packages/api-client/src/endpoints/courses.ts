/**
 * Courses (backend: src/modules/courses).
 *
 * Staff routes: /workspaces/:workspaceId/courses (products.view /
 * products.manage; students need customers.view / customers.manage). The
 * student's side is public at /store/:workspaceId/learn: a code by SMS, then
 * a token sent as the `X-Student-Token` header. Free-preview lessons need no
 * token.
 *
 * Notable codes: COURSE_EMPTY (409), COURSE_HAS_STUDENTS (409), LESSON_LOCKED
 * (403), LESSON_NOT_RELEASED (403, `details.availableAt`),
 * STUDENT_SESSION_EXPIRED (401), INVALID_CODE / EXPIRED (422).
 */
import type { ApiClient } from "../client";

export type LessonKind = "video" | "text" | "file";

export interface CourseLesson {
  id: string;
  moduleId: string;
  title: string;
  kind: LessonKind;
  durationSeconds: number | null;
  isFreePreview: boolean;
  /** Released this many days after the student enrolled; 0 = at once. */
  dripDays: number;
  position: number;
  /** A link to an external player (YouTube, Vimeo, Bunny…). */
  videoUrl: string | null;
  body: string | null;
  /** A file from the digital file library. */
  fileId: string | null;
  fileName: string | null;
}

export interface CourseModule {
  id: string;
  title: string;
  position: number;
  lessons: CourseLesson[];
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  status: "draft" | "published";
  /** The product whose purchase enrolls the buyer. */
  productId: string | null;
  createdAt: string;
  /** On the list. */
  lessonsCount?: number;
  studentsCount?: number;
  /** On the detail. */
  modules?: CourseModule[];
}

export interface CoursePayload {
  title: string;
  slug?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  productId?: string | null;
  status?: "draft" | "published";
}

/** A lesson as the editor sends it. With `id` it is kept (progress stays attached); without, it is new. */
export interface LessonInput {
  id?: string;
  title: string;
  kind: LessonKind;
  videoUrl?: string | null;
  body?: string | null;
  fileId?: string | null;
  durationSeconds?: number | null;
  isFreePreview?: boolean;
  dripDays?: number;
}

export interface ModuleInput {
  id?: string;
  title: string;
  lessons: LessonInput[];
}

export interface CourseStudent {
  id: string;
  customerId: string;
  name: string | null;
  phone: string | null;
  source: "order" | "manual";
  orderId: string | null;
  enrolledAt: string;
  revokedAt: string | null;
  completedLessons: number;
}

export interface CourseStudents {
  lessonsCount: number;
  students: CourseStudent[];
}

const coursesBase = (workspaceId: string) => `/workspaces/${workspaceId}/courses`;

export async function coursesList(client: ApiClient, workspaceId: string): Promise<Course[]> {
  const { courses } = await client.request<{ courses: Course[] }>(coursesBase(workspaceId));
  return courses;
}

export async function coursesGet(client: ApiClient, workspaceId: string, courseId: string): Promise<Course> {
  const { course } = await client.request<{ course: Course }>(`${coursesBase(workspaceId)}/${courseId}`);
  return course;
}

export async function coursesCreate(client: ApiClient, workspaceId: string, payload: CoursePayload): Promise<Course> {
  const { course } = await client.request<{ course: Course }>(coursesBase(workspaceId), { method: "POST", body: payload });
  return course;
}

export async function coursesUpdate(client: ApiClient, workspaceId: string, courseId: string, payload: Partial<CoursePayload>): Promise<Course> {
  const { course } = await client.request<{ course: Course }>(`${coursesBase(workspaceId)}/${courseId}`, { method: "PATCH", body: payload });
  return course;
}

export async function coursesDelete(client: ApiClient, workspaceId: string, courseId: string): Promise<void> {
  await client.request<unknown>(`${coursesBase(workspaceId)}/${courseId}`, { method: "DELETE" });
}

/** Replaces the whole outline. Modules and lessons missing from `modules` are deleted. */
export async function coursesSaveOutline(client: ApiClient, workspaceId: string, courseId: string, modules: ModuleInput[]): Promise<Course> {
  const { course } = await client.request<{ course: Course }>(`${coursesBase(workspaceId)}/${courseId}/outline`, { method: "PUT", body: { modules } });
  return course;
}

export async function coursesStudents(client: ApiClient, workspaceId: string, courseId: string): Promise<CourseStudents> {
  return client.request<CourseStudents>(`${coursesBase(workspaceId)}/${courseId}/students`);
}

/** Gives someone access by hand. */
export async function coursesEnroll(client: ApiClient, workspaceId: string, courseId: string, payload: { phone: string; fullName?: string }): Promise<CourseStudents> {
  return client.request<CourseStudents>(`${coursesBase(workspaceId)}/${courseId}/students`, { method: "POST", body: payload });
}

export async function coursesSetEnrollmentRevoked(client: ApiClient, workspaceId: string, enrollmentId: string, revoked: boolean): Promise<CourseStudents> {
  return client.request<CourseStudents>(`${coursesBase(workspaceId)}/enrollments/${enrollmentId}`, { method: "POST", body: { revoked } });
}

// ----------------------------------------------------------------- student --

export interface StudentCourse {
  slug: string;
  title: string;
  coverUrl: string | null;
  lessonsCount: number;
  completedLessons: number;
  enrolledAt: string;
}

export interface StudentLessonRow {
  id: string;
  moduleId: string;
  title: string;
  kind: LessonKind;
  durationSeconds: number | null;
  isFreePreview: boolean;
  dripDays: number;
  position: number;
  /** Whether this viewer can open it now. */
  open: boolean;
  lockedReason: "not_enrolled" | "not_released" | null;
  availableAt: string | null;
  completed: boolean;
}

export interface StudentCourseOutline {
  course: { title: string; slug: string; description: string | null; coverUrl: string | null };
  enrolled: boolean;
  /** Where to buy it, for a visitor who is not enrolled. */
  product: { slug: string } | null;
  modules: { id: string; title: string; position: number; lessons: StudentLessonRow[] }[];
}

export interface StudentLesson {
  id: string;
  title: string;
  kind: LessonKind;
  durationSeconds: number | null;
  videoUrl: string | null;
  body: string | null;
  fileName: string | null;
}

const learnBase = (workspaceRef: string) => `/store/${workspaceRef}/learn`;
const studentHeaders = (token?: string | null) => (token ? { "X-Student-Token": token } : undefined);

/** Always answers — it does not reveal whether the phone has a course. */
export async function learnRequestCode(client: ApiClient, workspaceRef: string, phone: string): Promise<void> {
  await client.request<unknown>(`${learnBase(workspaceRef)}/request-code`, { method: "POST", body: { phone }, auth: false });
}

export async function learnVerify(client: ApiClient, workspaceRef: string, phone: string, code: string): Promise<{ token: string; expiresInSeconds: number }> {
  return client.request(`${learnBase(workspaceRef)}/verify`, { method: "POST", body: { phone, code }, auth: false });
}

export async function learnMyCourses(client: ApiClient, workspaceRef: string, token: string): Promise<StudentCourse[]> {
  const { courses } = await client.request<{ courses: StudentCourse[] }>(`${learnBase(workspaceRef)}/courses`, { auth: false, headers: studentHeaders(token) });
  return courses;
}

export async function learnCourse(client: ApiClient, workspaceRef: string, slug: string, token?: string | null): Promise<StudentCourseOutline> {
  return client.request<StudentCourseOutline>(`${learnBase(workspaceRef)}/courses/${encodeURIComponent(slug)}`, { auth: false, headers: studentHeaders(token) });
}

export async function learnLesson(client: ApiClient, workspaceRef: string, slug: string, lessonId: string, token?: string | null): Promise<StudentLesson> {
  const { lesson } = await client.request<{ lesson: StudentLesson }>(`${learnBase(workspaceRef)}/courses/${encodeURIComponent(slug)}/lessons/${lessonId}`, {
    auth: false,
    headers: studentHeaders(token),
  });
  return lesson;
}

/** A file lesson's bytes. The token travels in a header, never in the address. */
export async function learnDownloadLessonFile(
  apiBaseUrl: string,
  workspaceRef: string,
  slug: string,
  lessonId: string,
  token?: string | null
): Promise<Blob> {
  const url = `${apiBaseUrl.replace(/\/$/, "")}${learnBase(workspaceRef)}/courses/${encodeURIComponent(slug)}/lessons/${lessonId}/file`;
  const res = await fetch(url, { headers: studentHeaders(token) });
  if (!res.ok) throw new Error("Download failed with status " + res.status);
  return res.blob();
}

export async function learnSetCompleted(client: ApiClient, workspaceRef: string, slug: string, lessonId: string, token: string, completed: boolean): Promise<void> {
  await client.request<unknown>(`${learnBase(workspaceRef)}/courses/${encodeURIComponent(slug)}/lessons/${lessonId}/progress`, {
    method: "POST",
    body: { completed },
    auth: false,
    headers: studentHeaders(token),
  });
}
