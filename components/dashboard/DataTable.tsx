"use client";

import { useState, useMemo, memo, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n/context";

export interface DataTableColumn<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  getRowKey?: (row: T, index: number) => string | number;
}

function DataTableComponent<T extends Record<string, any>>({
  columns,
  data,
  onEdit,
  onDelete,
  getRowKey,
}: DataTableProps<T>) {
  const { t } = useLanguage();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<T | null>(null);

  const handleDeleteClick = useCallback((row: T) => {
    setRowToDelete(row);
    setDeleteConfirmOpen(true);
  }, []);

  // Memoize columns to prevent re-renders
  const tableHeaders = useMemo(() => {
    return columns.map((column) => (
      <TableHead key={String(column.key)} className="font-semibold text-primary px-6 py-4">
        {column.label}
      </TableHead>
    ));
  }, [columns]);

  // Memoize rows to prevent unnecessary re-renders
  const tableRows = useMemo(() => {
    return data.map((row, index) => {
      // Use custom key getter if provided, otherwise try id, then create composite key, then index
      const rowKey = getRowKey 
        ? getRowKey(row, index)
        : (row.id ?? `${row.province_id || ''}:${row.district_name || ''}:${row.school_name || ''}:${index}`);
      
      return (
      <TableRow key={rowKey}>
        {columns.map((column) => (
          <TableCell key={String(column.key)} className="px-6 py-4">
            {column.render
              ? column.render(row[column.key], row)
              : String(row[column.key])}
          </TableCell>
        ))}
        {(onEdit || onDelete) && (
          <TableCell className="px-6 py-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(row)}>
                    {t.table.edit}
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => handleDeleteClick(row)}
                    className="text-destructive"
                  >
                    {t.table.delete}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        )}
      </TableRow>
      );
    });
  }, [data, columns, onEdit, onDelete, t, handleDeleteClick, getRowKey]);

  const handleConfirmDelete = () => {
    if (rowToDelete && onDelete) {
      // IMPORTANT: Call the onDelete prop directly.
      // Do NOT use window.confirm() here. The confirmation is already handled.
      onDelete(rowToDelete);
    }
    setDeleteConfirmOpen(false);
    setRowToDelete(null);
  };
  
  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false);
    setRowToDelete(null);
  };

  return (
    <div className="border rounded-lg overflow-hidden dark:bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50 dark:hover:bg-muted/50">
            {tableHeaders}
            {(onEdit || onDelete) && <TableHead className="font-semibold text-primary px-6 py-4">{t.table.actions}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                className="text-center py-8 text-muted-foreground"
              >
                {t.table.noDataAvailable}
              </TableCell>
            </TableRow>
          ) : (
            tableRows
          )}
        </TableBody>
      </Table>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.common.confirmDelete}</DialogTitle>
            <DialogDescription>
              {t.common.confirmDeleteMessage}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDelete}>
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              {t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const DataTable = memo(DataTableComponent) as typeof DataTableComponent;