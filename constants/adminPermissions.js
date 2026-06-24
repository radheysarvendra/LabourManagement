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

const DEFAULT_ADMIN_ROLES = [
  { name: "super_admin", description: "Full admin dashboard access", accessLevel: 100 },
  { name: "admin", description: "Admin dashboard access", accessLevel: 90 },
  { name: "sub_admin", description: "Limited admin dashboard access", accessLevel: 70 },
  { name: "field_officer", description: "Field verification and order coordination", accessLevel: 50 },
  { name: "support", description: "Customer support access", accessLevel: 40 },
  { name: "verifier", description: "Labour and owner verification access", accessLevel: 30 },
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
  DEFAULT_ADMIN_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  getDefaultPermissionsForRole,
};
