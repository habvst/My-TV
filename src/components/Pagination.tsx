import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowRight
} from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage = 60,
  onPageChange,
  disabled = false,
}) => {
  const [jumpPage, setJumpPage] = useState<string>('');

  useEffect(() => {
    setJumpPage('');
  }, [currentPage]);

  if (totalPages <= 1 && totalItems <= itemsPerPage) {
    return null;
  }

  // Calculate range of items currently displayed
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  // Helper to generate page numbers with ellipses
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const pages = getPageNumbers();

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpPage, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      onPageChange(parsed);
      setJumpPage('');
    }
  };

  return (
    <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-3 flex flex-col gap-2.5 text-xs select-none shadow-sm">
      {/* Information Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-neutral-400 text-[11px] pb-2 border-b border-neutral-800/80">
        <div className="flex items-center gap-1.5">
          <span>
            Trang <strong className="text-amber-400 font-bold">{currentPage}</strong> /{' '}
            <strong className="text-white">{totalPages}</strong>
          </span>
          <span className="text-neutral-600">&bull;</span>
          <span>
            Kênh <strong className="text-neutral-200">{startIndex.toLocaleString()}</strong> –{' '}
            <strong className="text-neutral-200">{endIndex.toLocaleString()}</strong> trên{' '}
            <strong className="text-emerald-400 font-semibold">{totalItems.toLocaleString()}</strong> kênh
          </span>
        </div>
        <div className="text-[10px] text-neutral-500 font-mono bg-neutral-950/60 px-2 py-0.5 rounded border border-neutral-800">
          Tối đa {itemsPerPage} kênh / trang
        </div>
      </div>

      {/* Main Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Navigation buttons */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full py-0.5">
          {/* First Page */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={disabled || currentPage <= 1}
            title="Về trang đầu tiên (Trang 1)"
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-800 text-neutral-300 disabled:cursor-not-allowed transition"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={disabled || currentPage <= 1}
            title="Trang trước"
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-800 text-neutral-300 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {pages.map((p, idx) => {
              if (p === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-1 text-neutral-500 select-none text-[11px]"
                  >
                    ...
                  </span>
                );
              }

              const pageNum = p as number;
              const isActive = pageNum === currentPage;

              return (
                <button
                  key={`page-${pageNum}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPageChange(pageNum)}
                  className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-semibold transition flex items-center justify-center ${
                    isActive
                      ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20 font-bold scale-105'
                      : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next Page */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={disabled || currentPage >= totalPages}
            title="Trang tiếp theo"
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-800 text-neutral-300 disabled:cursor-not-allowed transition"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={disabled || currentPage >= totalPages}
            title={`Đến trang cuối cùng (Trang ${totalPages})`}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-800 text-neutral-300 disabled:cursor-not-allowed transition"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Jump to page form */}
        <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5 ml-auto">
          <span className="text-[11px] text-neutral-400 whitespace-nowrap">Đến trang:</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpPage}
            onChange={(e) => setJumpPage(e.target.value)}
            placeholder={String(currentPage)}
            className="w-14 bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1 text-center text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={disabled || !jumpPage}
            className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:text-amber-200 disabled:opacity-30 disabled:hover:bg-amber-500/10 rounded-lg text-xs font-medium transition flex items-center gap-1"
          >
            <span>Đi</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </form>
      </div>
    </div>
  );
};
