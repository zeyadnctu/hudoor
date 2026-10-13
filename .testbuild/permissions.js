"use strict";
// Permission matrix: dependency-free so it can be unit-tested with plain node.
// System roles get base grants; profiles.custom_role adds grants from role_permissions.
// `manage` on a resource implies all actions on it. resource/action '*' = wildcard.
Object.defineProperty(exports, "__esModule", { value: true });
exports.COURSE_SCOPED = exports.RESOURCES = void 0;
exports.can = can;
exports.ownsCourse = ownsCourse;
exports.RESOURCES = [
    "users", "faculties", "departments", "programs", "courses", "enrollments",
    "rooms", "timetable", "semesters", "sessions", "attendance", "excuses",
    "disputes", "announcements", "notifications", "settings", "audit",
    "trash", "requests", "flags"
];
// Base matrix for system roles. Narrow on purpose: course-scoped ownership is
// enforced separately by requirePerm (course_professors / course_tas / session owner).
const SYSTEM_MATRIX = {
    admin: [{ resource: "*", action: "*" }],
    professor: [
        { resource: "sessions", action: "manage" },
        { resource: "attendance", action: "view" },
        { resource: "attendance", action: "edit" },
        { resource: "attendance", action: "export" },
        { resource: "excuses", action: "decide" },
        { resource: "excuses", action: "view" },
        { resource: "disputes", action: "decide" },
        { resource: "disputes", action: "view" },
        { resource: "announcements", action: "create" },
        { resource: "announcements", action: "view" },
        { resource: "courses", action: "view" },
        { resource: "enrollments", action: "view" },
        { resource: "rooms", action: "view" },
        { resource: "timetable", action: "view" },
        { resource: "users", action: "view" },
        { resource: "flags", action: "view" },
        { resource: "flags", action: "create" }
    ],
    ta: [
        { resource: "attendance", action: "view" },
        { resource: "attendance", action: "edit" },
        { resource: "sessions", action: "view" },
        { resource: "enrollments", action: "view" },
        { resource: "announcements", action: "view" }
    ],
    department_admin: [],
    student: [
        { resource: "attendance", action: "view" },
        { resource: "excuses", action: "create" },
        { resource: "excuses", action: "view" },
        { resource: "disputes", action: "create" },
        { resource: "disputes", action: "view" },
        { resource: "announcements", action: "view" },
        { resource: "requests", action: "create" },
        { resource: "requests", action: "view" }
    ]
};
function matchGrant(grants, resource, action) {
    return grants.some(g => (g.resource === "*" || g.resource === resource) &&
        (g.action === "*" || g.action === "manage" || g.action === action));
}
/** Pure decision: does this profile hold (resource, action)? */
function can(profile, resource, action, extraGrants = []) {
    if (!profile || profile.is_active === false || profile.status === "suspended")
        return false;
    const grants = [
        ...(SYSTEM_MATRIX[profile.role] ?? []),
        // custom_role augments (ta/department_admin/custom). A student with custom
        // TA duties keeps student grants plus TA grants.
        ...(profile.custom_role ? (SYSTEM_MATRIX[profile.custom_role] ?? []) : []),
        ...extraGrants // rows from role_permissions for custom roles
    ];
    return matchGrant(grants, resource, action);
}
/** Course-scoped ownership check (pure, injectable data for testability). */
function ownsCourse(profile, courseId, ctx) {
    if (profile.role === "admin")
        return true;
    if (ctx.taught.includes(courseId))
        return true;
    if ((profile.role === "ta" || profile.custom_role === "ta") && ctx.assisted.includes(courseId))
        return true;
    return false;
}
// Resources whose professor/TA grants are always scoped to their own courses.
exports.COURSE_SCOPED = [
    "sessions", "attendance", "enrollments", "excuses", "disputes"
];
