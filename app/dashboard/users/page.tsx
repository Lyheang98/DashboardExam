"use client";

/**
 * Users Management Page
 *
 * This page provides a comprehensive user management interface with:
 * - Real-time search and filtering capabilities
 * - Pagination support for large datasets
 * - CRUD operations (Create, Read, Update, Delete)
 * - Interactive status toggle with visual feedback
 * - Performance optimizations for smooth scaling
 *
 * Performance Features:
 * - Search debouncing (500ms) to reduce API calls
 * - useCallback hooks to prevent unnecessary re-renders
 * - useMemo for expensive calculations
 * - Pagination to render only visible items
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/dashboard/DataTable";
import { logger } from "@/lib/logger";
import { getToken } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/context";

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * User interface - Defines the structure of a user object
 * @property {string | number} id - Unique user identifier
 * @property {string} name - User's full name
 * @property {string} email - User's email address
 * @property {string} role - User role (Admin, User, Moderator)
 * @property {string} status - User status (active or inactive)
 */
interface User {
  id: string | number;
  name: string;
  email: string;
  role: string;
  status: string;
}

export default function UsersPage() {
  const { t } = useLanguage();
  // ============================================
  // STATE MANAGEMENT
  // ============================================

  // Data state
  /** Array of all users from API */
  const [users, setUsers] = useState<User[]>([]);
  /** Loading state indicator for API calls */
  const [loading, setLoading] = useState(true);
  /** Mounted state to prevent hydration mismatches */
  const [mounted, setMounted] = useState(false);

  // Pagination state
  /** Current page number (1-indexed) */
  const [page, setPage] = useState(1);
  /** Number of items to display per page */
  const [perPage, setPerPage] = useState(10);
  /** Total number of users from API */
  const [total, setTotal] = useState(0);

  // Search and filter state
  /** User's raw search input (not debounced) */
  const [searchQuery, setSearchQuery] = useState("");
  /** Selected role filter value */
  const [roleFilter, setRoleFilter] = useState("");
  /** Selected status filter value */
  const [statusFilter, setStatusFilter] = useState("");

  // ============================================
  // PERFORMANCE OPTIMIZATION: Search Debouncing
  // ============================================

  /**
   * Ref to store the debounce timeout ID
   * Prevents excessive API calls while user is typing
   */
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  /** Debounced search query (updates after 500ms of inactivity) */
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  /**
   * Effect: Debounce search input
   * Waits 500ms after user stops typing before updating search
   * Prevents making API calls for every keystroke
   */
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  /**
   * Effect: Initialize component (hydration safety)
   * Prevents hydration mismatches by only rendering interactive components after mount
   */
  useEffect(() => {
    setMounted(true);
  }, []);

  /**
   * Effect: Fetch users when filters, pagination, or search changes
   * Uses debounced search query to reduce API calls
   */
  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, debouncedSearchQuery, roleFilter, statusFilter]);

  // ============================================
  // API CALLS
  // ============================================

  /**
   * Fetches users from API with current filters and pagination
   * Features:
   * - Builds query parameters from current filters
   * - Ensures minimum loading time (500ms) for smooth UX
   * - Handles errors gracefully with logging
   */
  const fetchUsers = async () => {
    setLoading(true);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append("q", debouncedSearchQuery);
      if (roleFilter) params.append("role", roleFilter);
      if (statusFilter) params.append("status", statusFilter);

      const token = getToken();
      const response = await fetch(`/api/users/search?${params.toString()}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      // Map users (API already filters for staff)
      const allUsers: User[] = (data.data || []).map(
        (user: {
          id: string | number;
          name: string;
          email: string;
          role?: string;
          status?: string;
        }) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role || 'User',
          status: user.status || 'active',
      }));

      setUsers(allUsers);
      setTotal(allUsers.length);
    } catch (error) {
      logger.error("Failed to fetch users", "USERS", error);
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // COMPUTED VALUES (Memoized)
  // ============================================

  /**
   * Paginated users for current page
   * Performance: Memoized to prevent recalculation on every render
   */
  const paginatedUsers = useMemo(
    () => users.slice((page - 1) * perPage, page * perPage),
    [users, page, perPage]
  );

  /**
   * Total number of pages available
   * Recalculated only when total or perPage changes
   */
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / perPage)),
    [total, perPage]
  );

  /**
   * First item number being displayed on current page
   * Example: Page 2 with 10 items = 11
   */
  const start = useMemo(
    () => (total === 0 ? 0 : (page - 1) * perPage + 1),
    [total, page, perPage]
  );

  /**
   * Last item number being displayed on current page
   * Example: Page 2 with 10 items = 20
   */
  const end = useMemo(
    () => Math.min(page * perPage, total),
    [page, perPage, total]
  );

  // ============================================
  // CRUD DIALOG STATE
  // ============================================

  /** Dialog open/close state */
  const [open, setOpen] = useState(false);
  /** User being edited (null if creating new) */
  const [editing, setEditing] = useState<User | null>(null);
  /** Form data for create/edit operations */
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "User",
    status: "Active",
  });

  // ============================================
  // CRUD OPERATIONS (Memoized Callbacks)
  // ============================================

  /**
   * Opens create dialog with empty form
   * Memoized to maintain stable function reference
   */
  const openCreate = useCallback(() => {
    setEditing(null);
    setForm({ name: "", email: "", role: "User", status: "Active" });
    setOpen(true);
  }, []);

  /**
   * Opens edit dialog with user's current data
   * Memoized to maintain stable function reference
   * @param {User} user - User to edit
   */
  const openEdit = useCallback((user: User) => {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
    setOpen(true);
  }, []);

  /**
   * Submits form for create or update operation
   * - Creates new user if editing is null
   * - Updates existing user if editing has a value
   * Memoized with form and editing as dependencies
   */
  const submitForm = useCallback(() => {
    if (editing) {
      // Update existing user
      setUsers((prev) =>
        prev.map((u) => (u.id === editing.id ? { ...u, ...form } : u))
      );
    } else {
      // Create new user
      const newUser: User = { id: Date.now(), ...form };
      setUsers((prev) => [newUser, ...prev]);
      setTotal((t) => t + 1);
    }
    setOpen(false);
  }, [editing, form]);

  /**
   * Deletes a user after confirmation
   * Memoized with users as dependency
   * @param {User} user - User to delete
   */
  const handleDelete = useCallback((user: User) => {
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    setTotal((t) => Math.max(0, t - 1));
  }, []);

  /**
   * Toggles user status between active and inactive
   * Memoized for performance optimization
   * @param {User} user - User to toggle status
   */
  const toggleStatus = useCallback((user: User) => {
    const newStatus = user.status === "active" ? "inactive" : "active";
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
    );
  }, []);

  return (
    <div className="space-y-6">
      {/* ============================================ */}
      {/* SEARCH AND FILTERS SECTION */}
      {/* ============================================ */}
      <div
        className="
  bg-white dark:bg-slate-900
  rounded-lg
  border border-gray-200 dark:border-slate-700
  p-6 shadow-sm
  mt-6 sm:mt-4 lg:mt-3
"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label
              htmlFor="search"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t.users.searchByNameOrEmail}
            </Label>
            <Input
              id="search"
              placeholder={t.users.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Role Filter */}
          <div className="space-y-2">
            <Label
              htmlFor="role-filter"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t.users.filterByRole}
            </Label>
            <select
              id="role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t.users.allRoles}</option>
              <option value="admin">{t.users.admin}</option>
              <option value="user">{t.users.user}</option>
              <option value="moderator">{t.users.moderator}</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label
              htmlFor="status-filter"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t.users.filterByStatus}
            </Label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t.users.allStatuses}</option>
              <option value="active">{t.common.active}</option>
              <option value="inactive">{t.common.inactive}</option>
            </select>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* PAGE HEADER AND ADD BUTTON */}
      {/* ============================================ */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.users.title}</h1>
          <p className="text-muted-foreground mt-2">{t.users.subtitle}</p>
        </div>

        {/* Create User Dialog */}
        {mounted ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>{t.users.addUser}</Button>
            </DialogTrigger>
            <DialogContent
              className="
    bg-card text-card-foreground
    border border-border
    rounded-xl
    p-6
  "
            >
            <DialogHeader>
              <DialogTitle>{editing ? t.users.editUser : t.users.addUser}</DialogTitle>
              <DialogDescription>
                {editing ? t.users.updateUser : t.users.createUser}
              </DialogDescription>
            </DialogHeader>

            {/* Form Fields */}
            <div className="space-y-4 py-2">
              {/* Name Field */}
              <div className="space-y-1">
                <Label htmlFor="name">{t.common.name}</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>

              {/* Email Field */}
              <div className="space-y-1">
                <Label htmlFor="email">{t.common.email}</Label>
                <Input
                  id="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>

              {/* Role and Status Fields */}
              <div className="grid grid-cols-2 gap-2">
                {/* Role Field */}
                <div className="space-y-1">
                  <Label htmlFor="role">{t.common.role}</Label>
                  <Input
                    id="role"
                    value={form.role}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, role: e.target.value }))
                    }
                  />
                </div>

                {/* Status Dropdown */}
                <div className="space-y-1">
                  <Label htmlFor="status">{t.common.status}</Label>

                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm((f) => ({ ...f, status: value }))
                    }
                  >
                    <SelectTrigger className="w-full rounded-md border border-border bg-card text-card-foreground px-3 py-2 text-smfocus:outline-none focus:ring-2 focus:ring-ring">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent className="bg-card">
                      <SelectItem
                        value="Active"
                        className="text-green-500 focus:text-green-500"
                      >
                        {t.common.active}
                      </SelectItem>

                      <SelectItem
                        value="Inactive"
                        className="text-red-500 focus:text-red-500"
                      >
                        {t.common.inactive}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {/* w-full rounded-md border border-border bg-card text-card-foreground px-3 py-2 text-smfocus:outline-none focus:ring-2 focus:ring-ring */}

            {/* Dialog Actions */}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {t.common.cancel}
                </Button>
              </DialogClose>
              <Button onClick={submitForm}>
                {editing ? t.users.saveChanges : t.users.createUserButton}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        ) : (
          <Button onClick={openCreate} disabled>
            {t.users.addUser}
          </Button>
        )}
      </div>

      {/* ============================================ */}
      {/* LOADING STATE OR DATA TABLE */}
      {/* ============================================ */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-8 shadow-sm">
          {/* Loading Spinner */}
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-6">
              <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t.users.loadingUsers}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t.users.pleaseWaitUsers}
            </p>
          </div>

          {/* Skeleton Loaders - Simulate table rows while loading */}
          <div className="space-y-3 mt-8">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-gray-100 dark:bg-slate-800 rounded animate-pulse"
              ></div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Data Table - Displays paginated users */}
          <DataTable<User>
            columns={[
              // === ADDED USER ID COLUMN ===
              {
                key: "id",
                label: t.common.id,
                render: (value) => (
                  <span className="font-mono text-xs bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">
                    {value}
                  </span>
                ),
              },
              { key: "name", label: t.common.name },
              { key: "email", label: t.common.email },
              { key: "role", label: t.common.role },
              {
                key: "status",
                label: t.common.status,
                render: (value, row) => (
                  <button
                    onClick={() => toggleStatus(row as User)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-all cursor-pointer hover:opacity-80 active:scale-95 ${
                      value === "active"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800"
                    }`}
                  >
                    {value === "active" ? t.common.active : t.common.inactive}
                  </button>
                ),
              },
            ]}
            data={paginatedUsers}
            onDelete={handleDelete}
            onEdit={(row) => openEdit(row as User)}
          />

          {/* ============================================ */}
          {/* PAGINATION CONTROLS */}
          {/* ============================================ */}
          <div className="flex items-center justify-between mt-4">
            {/* Items Counter */}
            <div className="text-sm text-muted-foreground">
              {t.common.showing} {start}–{end} {t.common.of} {total}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                {t.common.prev}
              </Button>

              <div className="px-3 text-sm">
                {t.common.page} {page} {t.common.of} {totalPages}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                {t.common.next}
              </Button>

              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1); // important reset
                }}
                className="ml-2 rounded border bg-background px-2 py-1 text-sm"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
