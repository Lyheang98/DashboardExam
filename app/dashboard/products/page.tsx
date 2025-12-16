"use client";

/**
 * Products Management Page
 * 
 * This page provides a comprehensive product inventory management interface with:
 * - Real-time product search and filtering by category and price
 * - Pagination support for large product catalogs
 * - CRUD operations (Create, Read, Update, Delete)
 * - Interactive status toggle with visual feedback (Available/Out of Stock)
 * - Performance optimizations for smooth scaling with large datasets
 * 
 * Performance Features:
 * - Search debouncing (500ms) to reduce API calls
 * - useCallback hooks to prevent unnecessary re-renders
 * - useMemo for expensive calculations and pagination
 * - Only renders visible items (paginated data)
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
 * Product interface - Defines the structure of a product object
 * @property {string | number} id - Unique product identifier
 * @property {string} name - Product name/title
 * @property {number} price - Product price in dollars
 * @property {string} category - Product category (e.g., Electronics, Clothing)
 * @property {number} stock - Current stock quantity
 * @property {string} status - Availability status (Available or Out of Stock)
 */
interface Product {
  id: string | number;
  name: string;
  price: number;
  category: string;
  stock: number;
  status: string;
}

export default function ProductsPage() {
  // ============================================
  // STATE MANAGEMENT
  // ============================================

  // Data state
  /** Array of all products from API */
  const [products, setProducts] = useState<Product[]>([]);
  /** Loading state indicator for API calls */
  const [loading, setLoading] = useState(true);

  // Pagination state
  /** Current page number (1-indexed) */
  const [page, setPage] = useState(1);
  /** Number of items to display per page */
  const [perPage, setPerPage] = useState(10);
  /** Total number of products from API */
  const [total, setTotal] = useState(0);

  // Search and filter state
  /** User's raw search input (not debounced) */
  const [searchQuery, setSearchQuery] = useState("");
  /** Selected category filter value */
  const [categoryFilter, setCategoryFilter] = useState("");
  /** Price range filter with min and max values */
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  
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
   * Effect: Fetch products when filters, pagination, or search changes
   * Uses debounced search query to reduce API calls
   */
  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, debouncedSearchQuery, categoryFilter, priceRange]);

  // ============================================
  // API CALLS
  // ============================================

  /**
   * Fetches products from API with current filters and pagination
   * Features:
   * - Builds query parameters from current filters and search
   * - Ensures minimum loading time (500ms) for smooth UX
   * - Handles errors gracefully with logging
   * - Automatically determines stock-based availability status
   */
  const fetchProducts = async () => {
    setLoading(true);
    setPage(1);
    const startTime = Date.now();
    try {
      // Build query parameters from filters
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append("q", debouncedSearchQuery);
      if (categoryFilter) params.append("category", categoryFilter);
      if (priceRange.min) params.append("minPrice", priceRange.min);
      if (priceRange.max) params.append("maxPrice", priceRange.max);

      // Fetch data from API
      const response = await fetch(`/api/products/search?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();

      // Format and validate product data
      const allProducts = (data.data || []).map((product: any) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category || "General",
        stock: product.stock || 0,
        // Auto-determine status based on stock level
        status: (product.stock || 0) > 0 ? "Available" : "Out of Stock",
      }));

      setTotal(allProducts.length);
      setProducts(allProducts);
      
      // Ensure minimum loading time for smooth visual feedback
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < 800) {
        await new Promise(resolve => setTimeout(resolve, 500 - elapsedTime));
      }
    } catch (error) {
      logger.error("Failed to fetch products", "PRODUCTS", error);
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // COMPUTED VALUES (Memoized)
  // ============================================

  /**
   * Paginated products for current page
   * Performance: Memoized to prevent recalculation on every render
   */
  const paginatedProducts = useMemo(
    () => products.slice((page - 1) * perPage, page * perPage),
    [products, page, perPage]
  );

  /**
   * Total number of pages available
   * Recalculated only when total or perPage changes
   */
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage]);
  
  /**
   * First product number being displayed on current page
   * Example: Page 2 with 10 items = 11
   */
  const start = useMemo(() => (total === 0 ? 0 : (page - 1) * perPage + 1), [total, page, perPage]);
  
  /**
   * Last product number being displayed on current page
   * Example: Page 2 with 10 items = 20
   */
  const end = useMemo(() => Math.min(page * perPage, total), [page, perPage, total]);

  // ============================================
  // CRUD DIALOG STATE
  // ============================================

  /** Dialog open/close state */
  const [open, setOpen] = useState(false);
  /** Product being edited (null if creating new) */
  const [editing, setEditing] = useState<Product | null>(null);
  /** Form data for create/edit operations */
  const [form, setForm] = useState({ name: "", price: 0, category: "", stock: 0, status: "Available" });

  // ============================================
  // CRUD OPERATIONS (Memoized Callbacks)
  // ============================================

  /**
   * Opens create dialog with empty form
   * Memoized to maintain stable function reference
   */
  const openCreate = useCallback(() => {
    setEditing(null);
    setForm({ name: "", price: 0, category: "", stock: 0, status: "Available" });
    setOpen(true);
  }, []);

  /**
   * Opens edit dialog with product's current data
   * Memoized to maintain stable function reference
   * @param {Product} product - Product to edit
   */
  const openEdit = useCallback((product: Product) => {
    setEditing(product);
    setForm({ name: product.name, price: product.price, category: product.category, stock: product.stock, status: product.status });
    setOpen(true);
  }, []);

  /**
   * Submits form for create or update operation
   * - Creates new product if editing is null
   * - Updates existing product if editing has a value
   * Memoized with form and editing as dependencies
   */
  const submitForm = useCallback(() => {
    if (editing) {
      // Update existing product
      setProducts((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...form } : p)));
    } else {
      // Create new product
      const newProduct: Product = { id: Date.now(), ...form };
      setProducts((prev) => [newProduct, ...prev]);
      setTotal((t) => t + 1);
    }
    setOpen(false);
  }, [editing, form]);

  /**
   * Deletes a product after confirmation
   * Memoized with products as dependency
   * @param {Product} product - Product to delete
   */
  const handleDelete = useCallback((product: Product) => {
    if (confirm("Are you sure you want to delete this product?")) {
      setProducts(products.filter((p) => p.id !== product.id));
    }
  }, [products]);

  /**
   * Toggles product status between Available and Out of Stock
   * Memoized for performance optimization
   * @param {Product} product - Product to toggle status
   */
  const toggleStatus = useCallback((product: Product) => {
    const newStatus = product.status === 'Available' ? 'Out of Stock' : 'Available';
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, status: newStatus } : p))
    );
  }, []);

  return (
    <div className="space-y-6">
      {/* ============================================ */}
      {/* SEARCH AND FILTERS SECTION */}
      {/* ============================================ */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Search & Filter</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="search" className="text-sm font-medium text-gray-700 dark:text-gray-300">Search by product name</Label>
            <Input
              id="search"
              placeholder="Type product name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Category Filter */}
          <div className="space-y-2">
            <Label htmlFor="category-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Category</Label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              <option value="electronics">Electronics</option>
              <option value="clothing">Clothing</option>
              <option value="furniture">Furniture</option>
              <option value="beauty">Beauty</option>
              <option value="groceries">Groceries</option>
              <option value="home-decoration">Home Decoration</option>
            </select>
          </div>

          {/* Price Range - Min Filter */}
          <div className="space-y-2">
            <Label htmlFor="price-min" className="text-sm font-medium text-gray-700 dark:text-gray-300">Min Price ($)</Label>
            <Input
              id="price-min"
              type="number"
              placeholder="0"
              value={priceRange.min}
              onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
              className="w-full"
            />
          </div>

          {/* Price Range - Max Filter */}
          <div className="space-y-2">
            <Label htmlFor="price-max" className="text-sm font-medium text-gray-700 dark:text-gray-300">Max Price ($)</Label>
            <Input
              id="price-max"
              type="number"
              placeholder="1000"
              value={priceRange.max}
              onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* PAGE HEADER AND ADD BUTTON */}
      {/* ============================================ */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-2">View and manage your product inventory.</p>
        </div>

        {/* Create Product Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>Add Product</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Product' : 'Add Product'}</DialogTitle>
              <DialogDescription>{editing ? 'Update product details' : 'Create a new product'}</DialogDescription>
            </DialogHeader>

            {/* Form Fields */}
            <div className="space-y-4 py-2">
              {/* Product Name Field */}
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>

              {/* Price and Stock Fields */}
              <div className="grid grid-cols-2 gap-2">
                {/* Price Field */}
                <div className="space-y-1">
                  <Label htmlFor="price">Price</Label>
                  <Input id="price" type="number" value={String(form.price)} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} />
                </div>

                {/* Stock Field */}
                <div className="space-y-1">
                  <Label htmlFor="stock">Stock</Label>
                  <Input id="stock" type="number" value={String(form.stock)} onChange={(e) => setForm((f) => ({ ...f, stock: Number(e.target.value) }))} />
                </div>
              </div>

              {/* Category Field */}
              <div className="space-y-1">
                <Label htmlFor="category">Category</Label>
                <Input id="category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
              </div>

              {/* Status Dropdown */}
              <div className="space-y-1">
                <Label htmlFor="status">Status</Label>
                <select id="status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full rounded border px-2 py-1">
                  <option>Available</option>
                  <option>Out of Stock</option>
                </select>
              </div>
            </div>

            {/* Dialog Actions */}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              </DialogClose>
              <Button onClick={submitForm}>{editing ? 'Save Changes' : 'Create Product'}</Button>
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
            <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading Products</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Please wait while we fetch your products...</p>
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
          {/* Data Table - Displays paginated products */}
          <DataTable<Product>
            columns={[
              { key: "name", label: "Product Name" },
              {
                key: "price",
                label: "Price",
                // Format price with dollar sign
                render: (value) => `$${value}`,
              },
              { key: "category", label: "Category" },
              { key: "stock", label: "Stock" },
              {
                key: "status",
                label: "Status",
                render: (value, row) => (
                  <button
                    onClick={() => toggleStatus(row as Product)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-all cursor-pointer hover:opacity-80 active:scale-95 ${
                      value === "Available"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800"
                    }`}
                  >
                    {value === "Available" ? "Available" : "Out of Stock"}
                  </button>
                ),
              },
            ]}
            data={paginatedProducts}
            onDelete={handleDelete}
            onEdit={(row) => openEdit(row as Product)}
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
