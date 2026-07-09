const ADMIN_ACTIONS = {
  VIEW: "canView",
  CREATE: "canCreate",
  UPDATE: "canUpdate",
  DELETE: "canDelete",
  APPROVE: "canApprove",
};

const ADMIN_MODULES = {
  DASHBOARD: "dashboard",
  ADMINS: "admins",
  ROLES: "roles",
  PERMISSIONS: "permissions",
  USERS: "users",
  LABOURS: "labours",
  OWNERS: "owners",
  CONTRACTORS: "contractors",
  BOOKINGS: "bookings",
  ORDERS: "orders",
  WORK_ASSIGNMENTS: "work_assignments",
  ATTENDANCE: "attendance",
  PAYMENTS: "payments",
  CATEGORIES: "categories",
  SKILLS: "skills",
  LOCATIONS: "locations",
  REPORTS: "reports",
  SETTINGS: "settings",
};

const ADMIN_MODULE_DETAILS = [
  { key: ADMIN_MODULES.DASHBOARD, label: "Dashboard", group: "General" },
  { key: ADMIN_MODULES.ADMINS, label: "Admins", group: "General" },
  { key: ADMIN_MODULES.ROLES, label: "Roles", group: "General" },
  { key: ADMIN_MODULES.PERMISSIONS, label: "Permissions", group: "General" },
  { key: ADMIN_MODULES.USERS, label: "Users", group: "Master" },
  { key: ADMIN_MODULES.LABOURS, label: "Labourers", group: "Master" },
  { key: ADMIN_MODULES.OWNERS, label: "Owners", group: "Master" },
  { key: ADMIN_MODULES.CONTRACTORS, label: "Contractors", group: "Master" },
  { key: ADMIN_MODULES.CATEGORIES, label: "Categories", group: "Master" },
  { key: ADMIN_MODULES.SKILLS, label: "Skills", group: "Master" },
  { key: ADMIN_MODULES.LOCATIONS, label: "Locations", group: "Master" },
  { key: ADMIN_MODULES.BOOKINGS, label: "Bookings", group: "Operations" },
  { key: ADMIN_MODULES.ORDERS, label: "Orders", group: "Operations" },
  { key: ADMIN_MODULES.WORK_ASSIGNMENTS, label: "Work Assignments", group: "Operations" },
  { key: ADMIN_MODULES.ATTENDANCE, label: "Attendance", group: "Operations" },
  { key: ADMIN_MODULES.PAYMENTS, label: "Payments", group: "Operations" },
  { key: ADMIN_MODULES.REPORTS, label: "Reports", group: "Insights" },
  { key: ADMIN_MODULES.SETTINGS, label: "Settings", group: "System" },
];

const DEFAULT_ADMIN_ROLES = [
  { name: "super_admin", description: "Full admin dashboard access" },
  { name: "admin", description: "Admin dashboard access" },
  { name: "sub_admin", description: "Limited admin dashboard access" },
  { name: "field_officer", description: "Field verification and order coordination" },
  { name: "support", description: "Customer support access" },
  { name: "verifier", description: "Labour and owner verification access" },
];

const FULL_ACCESS = {
  canView: true,
  canCreate: true,
  canUpdate: true,
  canDelete: true,
  canApprove: true,
};

const VIEW_ONLY = {
  canView: true,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
  canApprove: false,
};

const NO_ACCESS = {
  canView: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
  canApprove: false,
};

const DEFAULT_ROLE_PERMISSIONS = {
  super_admin: Object.values(ADMIN_MODULES).reduce((acc, moduleName) => {
    acc[moduleName] = FULL_ACCESS;
    return acc;
  }, {}),
  admin: Object.values(ADMIN_MODULES).reduce((acc, moduleName) => {
    acc[moduleName] = FULL_ACCESS;
    return acc;
  }, {}),
  sub_admin: {
    dashboard: VIEW_ONLY,
    admins: VIEW_ONLY,
    roles: VIEW_ONLY,
    permissions: VIEW_ONLY,
    labours: { ...VIEW_ONLY, canUpdate: true },
    owners: { ...VIEW_ONLY, canUpdate: true },
    contractors: { ...VIEW_ONLY, canUpdate: true },
    bookings: { ...VIEW_ONLY, canUpdate: true, canApprove: true },
    orders: { ...VIEW_ONLY, canUpdate: true, canApprove: true },
    work_assignments: { ...VIEW_ONLY, canCreate: true, canUpdate: true, canApprove: true },
    attendance: { ...VIEW_ONLY, canCreate: true, canUpdate: true },
    payments: { ...VIEW_ONLY, canCreate: true, canUpdate: true, canApprove: true },
    categories: VIEW_ONLY,
    skills: VIEW_ONLY,
    locations: VIEW_ONLY,
    reports: VIEW_ONLY,
    settings: NO_ACCESS,
  },
  field_officer: {
    dashboard: VIEW_ONLY,
    admins: NO_ACCESS,
    roles: NO_ACCESS,
    permissions: NO_ACCESS,
    labours: { ...VIEW_ONLY, canUpdate: true, canApprove: true },
    owners: { ...VIEW_ONLY, canUpdate: true, canApprove: true },
    contractors: { ...VIEW_ONLY, canUpdate: true, canApprove: true },
    bookings: { ...VIEW_ONLY, canUpdate: true },
    orders: { ...VIEW_ONLY, canUpdate: true, canApprove: true },
    work_assignments: { ...VIEW_ONLY, canCreate: true, canUpdate: true },
    attendance: { ...VIEW_ONLY, canCreate: true, canUpdate: true },
    payments: VIEW_ONLY,
    categories: VIEW_ONLY,
    skills: VIEW_ONLY,
    locations: VIEW_ONLY,
    reports: VIEW_ONLY,
    settings: NO_ACCESS,
  },
  support: {
    dashboard: VIEW_ONLY,
    admins: NO_ACCESS,
    roles: NO_ACCESS,
    permissions: NO_ACCESS,
    labours: VIEW_ONLY,
    owners: VIEW_ONLY,
    contractors: VIEW_ONLY,
    bookings: { ...VIEW_ONLY, canUpdate: true },
    orders: { ...VIEW_ONLY, canUpdate: true },
    work_assignments: VIEW_ONLY,
    attendance: VIEW_ONLY,
    payments: VIEW_ONLY,
    categories: VIEW_ONLY,
    skills: VIEW_ONLY,
    locations: VIEW_ONLY,
    reports: NO_ACCESS,
    settings: NO_ACCESS,
  },
  verifier: {
    dashboard: VIEW_ONLY,
    admins: NO_ACCESS,
    roles: NO_ACCESS,
    permissions: NO_ACCESS,
    labours: { ...VIEW_ONLY, canUpdate: true, canApprove: true },
    owners: { ...VIEW_ONLY, canUpdate: true, canApprove: true },
    contractors: { ...VIEW_ONLY, canUpdate: true, canApprove: true },
    bookings: VIEW_ONLY,
    orders: VIEW_ONLY,
    work_assignments: { ...VIEW_ONLY, canUpdate: true },
    attendance: { ...VIEW_ONLY, canCreate: true, canUpdate: true },
    payments: VIEW_ONLY,
    categories: VIEW_ONLY,
    skills: VIEW_ONLY,
    locations: VIEW_ONLY,
    reports: NO_ACCESS,
    settings: NO_ACCESS,
  },
};

const getDefaultPermissionsForRole = (roleName) =>
  DEFAULT_ROLE_PERMISSIONS[String(roleName || "").toLowerCase()] || {};

module.exports = {
  ADMIN_ACTIONS,
  ADMIN_MODULES,
  ADMIN_MODULE_DETAILS,
  DEFAULT_ADMIN_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  getDefaultPermissionsForRole,
};
