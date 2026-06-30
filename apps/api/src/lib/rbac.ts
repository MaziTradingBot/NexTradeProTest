// Central catalogue of permissions and the built-in admin roles.
// "Admin types" the client asked for (Withdrawal Approval Admin, General Admin,
// KYC Admin, etc.) are simply roles bundling a curated set of permissions.

export const PERMISSIONS = {
  // Dashboard
  'admin.access': { name: 'Access admin panel', group: 'Dashboard' },
  'admin.analytics.view': { name: 'View platform analytics', group: 'Dashboard' },

  // Users
  'users.view': { name: 'View users', group: 'Users' },
  'users.manage': { name: 'Create / edit / suspend users', group: 'Users' },
  'roles.assign': { name: 'Assign roles to users', group: 'Users' },
  'roles.manage': { name: 'Create / edit roles & permissions', group: 'Users' },

  // Withdrawals & finance
  'withdrawals.view': { name: 'View withdrawal requests', group: 'Withdrawals' },
  'withdrawals.approve': { name: 'Approve / reject withdrawals', group: 'Withdrawals' },
  'deposits.view': { name: 'View deposits', group: 'Finance' },
  'deposits.manage': { name: 'Manage deposits', group: 'Finance' },

  // KYC
  'kyc.view': { name: 'View KYC submissions', group: 'KYC' },
  'kyc.approve': { name: 'Approve / reject KYC', group: 'KYC' },

  // Support
  'support.view': { name: 'View support tickets', group: 'Support' },
  'support.manage': { name: 'Respond to / close tickets', group: 'Support' },

  // Content
  'content.manage': { name: 'Manage blog, news & CMS', group: 'Content' },

  // System
  'system.settings': { name: 'Manage platform settings', group: 'System' },
  'system.audit': { name: 'View audit logs', group: 'System' },
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export interface RoleSeed {
  key: string;
  name: string;
  description: string;
  isAdmin: boolean;
  isSystem: boolean;
  permissions: PermissionKey[] | '*';
}

export const ROLES: RoleSeed[] = [
  {
    key: 'USER',
    name: 'User',
    description: 'Standard registered trader.',
    isAdmin: false,
    isSystem: true,
    permissions: [],
  },
  {
    key: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Full, unrestricted access to every module.',
    isAdmin: true,
    isSystem: true,
    permissions: '*',
  },
  {
    key: 'GENERAL_ADMIN',
    name: 'General Admin',
    description: 'Day-to-day platform administration and analytics.',
    isAdmin: true,
    isSystem: true,
    permissions: ['admin.access', 'admin.analytics.view', 'users.view', 'support.view'],
  },
  {
    key: 'WITHDRAWAL_ADMIN',
    name: 'Withdrawal Approval Admin',
    description: 'Reviews and approves or rejects withdrawal requests.',
    isAdmin: true,
    isSystem: true,
    permissions: ['admin.access', 'withdrawals.view', 'withdrawals.approve', 'users.view'],
  },
  {
    key: 'FINANCE_ADMIN',
    name: 'Finance Admin',
    description: 'Manages deposits, withdrawals and financial records.',
    isAdmin: true,
    isSystem: true,
    permissions: [
      'admin.access',
      'deposits.view',
      'deposits.manage',
      'withdrawals.view',
      'withdrawals.approve',
      'admin.analytics.view',
    ],
  },
  {
    key: 'KYC_ADMIN',
    name: 'KYC Admin',
    description: 'Reviews and approves identity verification submissions.',
    isAdmin: true,
    isSystem: true,
    permissions: ['admin.access', 'kyc.view', 'kyc.approve', 'users.view'],
  },
  {
    key: 'SUPPORT_ADMIN',
    name: 'Support Admin',
    description: 'Handles customer support tickets and live chat.',
    isAdmin: true,
    isSystem: true,
    permissions: ['admin.access', 'support.view', 'support.manage', 'users.view'],
  },
  {
    key: 'CONTENT_ADMIN',
    name: 'Content Admin',
    description: 'Manages blog, news, academy and landing-page content.',
    isAdmin: true,
    isSystem: true,
    permissions: ['admin.access', 'content.manage'],
  },
  {
    key: 'USER_ADMIN',
    name: 'User Management Admin',
    description: 'Manages user accounts and assigns roles.',
    isAdmin: true,
    isSystem: true,
    permissions: ['admin.access', 'users.view', 'users.manage', 'roles.assign'],
  },
];
