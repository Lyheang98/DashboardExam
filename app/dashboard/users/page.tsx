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
  // ============================================
  // STATE MANAGEMENT
  // ============================================

  // Data state
  /** Array of all users from API */
  const [users, setUsers] = useState<User[]>([]);
  /** Loading state indicator for API calls */
  const [loading, setLoading] = useState(true);

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
    setPage(1);
    const startTime = Date.now();
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append("q", debouncedSearchQuery);
      if (roleFilter) params.append("role", roleFilter);
      if (statusFilter) params.append("status", statusFilter);

      // Fetch data from API
      const response = await fetch(`/api/users/search?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();

      // Format and validate user data
      const formattedUsers = (data.data || []).map((user: any) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || "User",
        status: user.status || "active",
      }));

      setTotal(data.count || formattedUsers.length);
      setUsers(formattedUsers);
      
      // Ensure minimum loading time for smooth visual feedback
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < 800) {
        await new Promise(resolve => setTimeout(resolve, 500 - elapsedTime));
      }
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
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage]);
  
  /**
   * First item number being displayed on current page
   * Example: Page 2 with 10 items = 11
   */
  const start = useMemo(() => (total === 0 ? 0 : (page - 1) * perPage + 1), [total, page, perPage]);
  
  /**
   * Last item number being displayed on current page
   * Example: Page 2 with 10 items = 20
   */
  const end = useMemo(() => Math.min(page * perPage, total), [page, perPage, total]);

  // ============================================
  // CRUD DIALOG STATE
  // ============================================

  /** Dialog open/close state */
  const [open, setOpen] = useState(false);
  /** User being edited (null if creating new) */
  const [editing, setEditing] = useState<User | null>(null);
  /** Form data for create/edit operations */
  const [form, setForm] = useState({ name: "", email: "", role: "User", status: "Active" });

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
    setForm({ name: user.name, email: user.email, role: user.role, status: user.status });
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
      setUsers((prev) => prev.map((u) => (u.id === editing.id ? { ...u, ...form } : u)));
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
    if (confirm("Are you sure you want to delete this user?")) {
      setUsers(users.filter((u) => u.id !== user.id));
    }
  }, [users]);

  /**
   * Toggles user status between active and inactive
   * Memoized for performance optimization
   * @param {User} user - User to toggle status
   */
  const toggleStatus = useCallback((user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
    );
  }, []);

  return (
    <div className="space-y-6">
      {/* ============================================ */}
      {/* SEARCH AND FILTERS SECTION */}
      {/* ============================================ */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Search & Filter</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="search" className="text-sm font-medium text-gray-700 dark:text-gray-300">Search by name or email</Label>
            <Input
              id="search"
              placeholder="Type name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Role Filter */}
          <div className="space-y-2">
            <Label htmlFor="role-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Role</Label>
            <select
              id="role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label htmlFor="status-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Status</Label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* PAGE HEADER AND ADD BUTTON */}
      {/* ============================================ */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-2">Manage and view users.</p>
        </div>

        {/* Create User Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit User' : 'Add User'}</DialogTitle>
              <DialogDescription>{editing ? 'Update user details' : 'Create a new user'}</DialogDescription>
            </DialogHeader>

            {/* Form Fields */}
            <div className="space-y-4 py-2">
              {/* Name Field */}
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>

              {/* Email Field */}
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>

              {/* Role and Status Fields */}
              <div className="grid grid-cols-2 gap-2">
                {/* Role Field */}
                <div className="space-y-1">
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
                </div>

                {/* Status Dropdown */}
                <div className="space-y-1">
                  <Label htmlFor="status">Status</Label>
                  <select id="status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full rounded border px-2 py-1">
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Dialog Actions */}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              </DialogClose>
              <Button onClick={submitForm}>{editing ? 'Save Changes' : 'Create User'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading Users</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Please wait while we fetch your users...</p>
          </div>

          {/* Skeleton Loaders - Simulate table rows while loading */}
          <div className="space-y-3 mt-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-slate-800 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Data Table - Displays paginated users */}
          <DataTable<User>
            columns={[
              { key: "name", label: "Name" },
              { key: "email", label: "Email" },
              { key: "role", label: "Role" },
              {
                key: "status",
                label: "Status",
                render: (value, row) => (
                  <button
                    onClick={() => toggleStatus(row as User)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-all cursor-pointer hover:opacity-80 active:scale-95 ${
                      value === "active"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800"
                    }`}
                  >
                    {value === "active" ? "Active" : "Inactive"}
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
              Showing {start}–{end} of {total}
            </div>

            {/* Navigation and Options */}
            <div className="flex items-center gap-2">
              {/* Previous Page Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>

              {/* Current Page Indicator */}
              <div className="px-3 text-sm">
                Page {page} of {totalPages}
              </div>

              {/* Next Page Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>

              {/* Items Per Page Selector */}
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1); // Reset to page 1 when changing items per page
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
