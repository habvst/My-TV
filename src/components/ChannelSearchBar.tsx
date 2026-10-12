import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface ChannelSearchBarProps {
  value: string;
  onChange: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export const ChannelSearchBar: React.FC<ChannelSearchBarProps> = React.memo(
  function ChannelSearchBar({
    value: externalValue,
    onChange,
    placeholder = 'Tìm kiếm kênh trong toàn bộ hệ thống...',
    debounceMs = 280,
  }) {
    // Local state for instant, 0-latency keystrokes
    const [inputValue, setInputValue] = useState<string>(externalValue);
    const [isDebouncing, setIsDebouncing] = useState<boolean>(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // Synchronize local input if parent resets or changes search value externally
    useEffect(() => {
      setInputValue((prev) => (prev !== externalValue ? externalValue : prev));
    }, [externalValue]);

    // Handle user typing
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextVal = e.target.value;
      setInputValue(nextVal);
      setIsDebouncing(true);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        setIsDebouncing(false);
        onChangeRef.current(nextVal);
      }, debounceMs);
    };

    // Instant clear
    const handleClear = useCallback(() => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setInputValue('');
      setIsDebouncing(false);
      onChangeRef.current('');
    }, []);

    // Instant submit on Enter key
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        setIsDebouncing(false);
        onChangeRef.current(inputValue);
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };

    useEffect(() => {
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }, []);

    return (
      <div className="relative w-full">
        <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-16 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition shadow-inner"
        />

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {isDebouncing && (
            <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
          )}

          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="px-1.5 py-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded text-xs flex items-center gap-0.5 transition cursor-pointer"
              title="Xóa tìm kiếm (Esc)"
            >
              <X className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden sm:inline">Xóa</span>
            </button>
          )}
        </div>
      </div>
    );
  }
);
