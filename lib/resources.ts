// Resource registry: adding a new managed resource = one entry here + one
// CrudPage usage. The generic /api/console/[resource] route reads this file.
// See README "Adding a new managed resource".

export type FieldType =
  | "text" | "textarea" | "number" | "date" | "time" | "datetime"
  | "boolean" | "select" | "multiselect" | "uuid";

export type FieldDef = {
  key: string;
  label: string; labelAr?: string;
  type: FieldType;
  required?: boolean;
  readOnly?: boolean;
  showInList?: boolean;
  inline?: boolean; // double-click to edit in table
  options?: { value: string; label: string }[]; // static select options
  optionsFrom?: string; // resource name to load options from (id + label cols)
  optionLabel?: string; // column used as label when optionsFrom is set
  placeholder?: string;
};

export type ResourceDef = {
  name: string;
  table: string;
  label: string; labelAr: string;
  searchCols: string[];
  defaultSort: string;
  softDelete?: boolean;
  pk?: string; // default "id"
  fields: FieldDef[];
};

export const RESOURCES: Record<string, ResourceDef> = {
  faculties: {
    name: "faculties", table: "faculties", label: "Faculties", labelAr: "الكليات",
    searchCols: ["name_en", "name_ar"], defaultSort: "name_ar", softDelete: true,
    fields: [
      { key: "name_ar", label: "Name (AR)", type: "text", required: true, showInList: true, inline: true },
      { key: "name_en", label: "Name (EN)", type: "text", required: true, showInList: true, inline: true },
      { key: "head_id", label: "Head (professor id)", type: "uuid" }
    ]
  },
  departments: {
    name: "departments", table: "departments", label: "Departments", labelAr: "الأقسام",
    searchCols: ["name_en", "name_ar"], defaultSort: "name_ar", softDelete: true,
    fields: [
      { key: "faculty_id", label: "Faculty", type: "select", required: true, optionsFrom: "faculties", optionLabel: "name_ar", showInList: true },
      { key: "name_ar", label: "Name (AR)", type: "text", required: true, showInList: true, inline: true },
      { key: "name_en", label: "Name (EN)", type: "text", required: true, showInList: true, inline: true },
      { key: "head_id", label: "Head (professor id)", type: "uuid" }
    ]
  },
  programs: {
    name: "programs", table: "programs", label: "Programs", labelAr: "البرامج",
    searchCols: ["code", "name_en", "name_ar", "partner"], defaultSort: "code", softDelete: true,
    fields: [
      { key: "code", label: "Code", type: "text", required: true, showInList: true, inline: true },
      { key: "name_ar", label: "Name (AR)", type: "text", required: true, showInList: true, inline: true },
      { key: "name_en", label: "Name (EN)", type: "text", required: true, showInList: true },
      { key: "partner", label: "Partner", type: "text", showInList: true, inline: true, placeholder: "e.g. NTG company" },
      { key: "type", label: "Type", type: "select", required: true, showInList: true, options: [{ value: "partner", label: "partner" }, { value: "regular", label: "regular" }] },
      { key: "color", label: "Color", type: "text", showInList: true, placeholder: "#7C3AED" },
      { key: "archived", label: "Archived", type: "boolean", showInList: true }
    ]
  },
  levels: {
    name: "levels", table: "levels", label: "Levels", labelAr: "المستويات",
    searchCols: ["name_en", "name_ar"], defaultSort: "position",
    fields: [
      { key: "program_id", label: "Program", type: "select", required: true, optionsFrom: "programs", optionLabel: "code", showInList: true },
      { key: "name_ar", label: "Name (AR)", type: "text", required: true, showInList: true, inline: true },
      { key: "name_en", label: "Name (EN)", type: "text", required: true, showInList: true },
      { key: "position", label: "Order", type: "number", showInList: true, inline: true }
    ]
  },
  section_groups: {
    name: "section_groups", table: "section_groups", label: "Sections & Groups", labelAr: "الشعب والمجموعات",
    searchCols: ["name"], defaultSort: "name",
    fields: [
      { key: "level_id", label: "Level", type: "select", required: true, optionsFrom: "levels", optionLabel: "name_ar", showInList: true },
      { key: "name", label: "Name", type: "text", required: true, showInList: true, inline: true }
    ]
  },
  semesters: {
    name: "semesters", table: "semesters", label: "Semesters", labelAr: "الفصول الدراسية",
    searchCols: ["name"], defaultSort: "starts_at", softDelete: true,
    fields: [
      { key: "name", label: "Name", type: "text", required: true, showInList: true, inline: true },
      { key: "starts_at", label: "Starts", type: "date", required: true, showInList: true },
      { key: "ends_at", label: "Ends", type: "date", required: true, showInList: true },
      { key: "is_current", label: "Current", type: "boolean", showInList: true }
    ]
  },
  courses: {
    name: "courses", table: "courses", label: "Courses", labelAr: "المواد",
    searchCols: ["code", "name_en", "name_ar"], defaultSort: "code", softDelete: true,
    fields: [
      { key: "code", label: "Code", type: "text", required: true, showInList: true, inline: true },
      { key: "name_ar", label: "Name (AR)", type: "text", required: true, showInList: true, inline: true },
      { key: "name_en", label: "Name (EN)", type: "text", required: true, showInList: true },
      { key: "credit_hours", label: "Credit hours", type: "number", showInList: true, inline: true },
      { key: "program_id", label: "Program", type: "select", optionsFrom: "programs", optionLabel: "code", showInList: true },
      { key: "semester_id", label: "Semester", type: "select", optionsFrom: "semesters", optionLabel: "name" },
      { key: "section", label: "Section", type: "text", showInList: true, inline: true }
    ]
  },
  buildings: {
    name: "buildings", table: "buildings", label: "Buildings", labelAr: "المباني",
    searchCols: ["name_en", "name_ar"], defaultSort: "name_ar", softDelete: true,
    fields: [
      { key: "name_ar", label: "Name (AR)", type: "text", required: true, showInList: true, inline: true },
      { key: "name_en", label: "Name (EN)", type: "text", required: true, showInList: true, inline: true }
    ]
  },
  rooms: {
    name: "rooms", table: "rooms", label: "Rooms", labelAr: "القاعات",
    searchCols: ["name_en", "name_ar"], defaultSort: "name_ar", softDelete: true,
    fields: [
      { key: "building_id", label: "Building", type: "select", optionsFrom: "buildings", optionLabel: "name_ar", showInList: true },
      { key: "name_ar", label: "Name (AR)", type: "text", required: true, showInList: true, inline: true },
      { key: "name_en", label: "Name (EN)", type: "text", required: true, showInList: true },
      { key: "capacity", label: "Capacity", type: "number", showInList: true, inline: true },
      { key: "geofence_lat", label: "Latitude", type: "number" },
      { key: "geofence_lng", label: "Longitude", type: "number" },
      { key: "geofence_radius_m", label: "Radius (m)", type: "number", showInList: true }
    ]
  },
  timetable_slots: {
    name: "timetable_slots", table: "timetable_slots", label: "Timetable slots", labelAr: "حصص الجدول",
    searchCols: ["section", "group_name"], defaultSort: "day", softDelete: true,
    fields: [
      { key: "semester_id", label: "Semester", type: "select", required: true, optionsFrom: "semesters", optionLabel: "name" },
      { key: "course_id", label: "Course", type: "select", required: true, optionsFrom: "courses", optionLabel: "code" },
      { key: "day", label: "Day (0=Sun)", type: "number", required: true, showInList: true },
      { key: "starts_at", label: "Starts", type: "time", required: true, showInList: true },
      { key: "ends_at", label: "Ends", type: "time", required: true, showInList: true },
      { key: "section", label: "Section", type: "text", showInList: true },
      { key: "group_name", label: "Group", type: "text", showInList: true }
    ]
  },
  academic_blocks: {
    name: "academic_blocks", table: "academic_blocks", label: "Holidays & exams", labelAr: "الإجازات والامتحانات",
    searchCols: ["name_en", "name_ar"], defaultSort: "starts_at",
    fields: [
      { key: "semester_id", label: "Semester", type: "select", required: true, optionsFrom: "semesters", optionLabel: "name" },
      { key: "kind", label: "Kind", type: "select", required: true, showInList: true, options: [{ value: "holiday", label: "holiday" }, { value: "exam", label: "exam" }] },
      { key: "name_ar", label: "Name (AR)", type: "text", required: true, showInList: true },
      { key: "name_en", label: "Name (EN)", type: "text", required: true, showInList: true },
      { key: "starts_at", label: "Starts", type: "date", required: true, showInList: true },
      { key: "ends_at", label: "Ends", type: "date", required: true, showInList: true }
    ]
  },
  announcements: {
    name: "announcements", table: "announcements", label: "Announcements", labelAr: "الإعلانات",
    searchCols: ["title_en", "title_ar"], defaultSort: "created_at", softDelete: true,
    fields: [
      { key: "title_ar", label: "Title (AR)", type: "text", required: true, showInList: true },
      { key: "title_en", label: "Title (EN)", type: "text", required: true, showInList: true },
      { key: "body_ar", label: "Body (AR)", type: "textarea", required: true },
      { key: "body_en", label: "Body (EN)", type: "textarea", required: true }
    ]
  },
  notification_templates: {
    name: "notification_templates", table: "notification_templates", label: "Message templates", labelAr: "قوالب الرسائل",
    searchCols: ["key", "trigger"], defaultSort: "key", pk: "key",
    fields: [
      { key: "key", label: "Key", type: "text", required: true, readOnly: true, showInList: true },
      { key: "trigger", label: "Trigger", type: "text", required: true, showInList: true },
      { key: "title_ar", label: "Title (AR)", type: "text", required: true },
      { key: "title_en", label: "Title (EN)", type: "text", required: true },
      { key: "body_ar", label: "Body (AR)", type: "textarea", required: true },
      { key: "body_en", label: "Body (EN)", type: "textarea", required: true }
    ]
  },
  feature_flags: {
    name: "feature_flags", table: "feature_flags", label: "Feature flags", labelAr: "الخصائص",
    searchCols: ["key"], defaultSort: "key", pk: "key",
    fields: [
      { key: "key", label: "Key", type: "text", required: true, readOnly: true, showInList: true },
      { key: "enabled", label: "Enabled", type: "boolean", showInList: true },
      { key: "description", label: "Description", type: "text", showInList: true }
    ]
  },
  roles: {
    name: "roles", table: "roles", label: "Roles", labelAr: "الأدوار",
    searchCols: ["name", "label_en", "label_ar"], defaultSort: "name", pk: "name",
    fields: [
      { key: "name", label: "Name", type: "text", required: true, readOnly: true, showInList: true },
      { key: "label_ar", label: "Label (AR)", type: "text", required: true, showInList: true },
      { key: "label_en", label: "Label (EN)", type: "text", required: true, showInList: true },
      { key: "is_system", label: "System", type: "boolean", readOnly: true, showInList: true }
    ]
  }
};
