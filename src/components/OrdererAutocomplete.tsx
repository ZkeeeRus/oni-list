import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User, X } from 'lucide-react';
import { OrdererStat } from '../utils/orderers';

interface OrdererAutocompleteProps {
  value: string;
  onChange: (next: string) => void;
  orderers: OrdererStat[];
  placeholder?: string;
  variant?: 'filter' | 'form';
}

export const OrdererAutocomplete: React.FC<OrdererAutocompleteProps> = ({
  value,
  onChange,
  orderers,
  placeholder = 'Фильтр по заказчику...',
  variant = 'filter',
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    const filtered = q
      ? orderers.filter((o) => o.display.toLowerCase().includes(q))
      : orderers;
    return filtered.slice(0, 12);
  }, [orderers, value]);

  if (variant === 'form') {
    return (
      <div className="orderer-ac-wrap" ref={wrapRef}>
        <input
          className="input"
          value={value}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
        />
        {open && suggestions.length > 0 && (
          <div className="orderer-ac-dropdown">
            {suggestions.map((s) => (
              <button
                key={s.key}
                type="button"
                className="orderer-ac-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(s.display);
                  setOpen(false);
                }}
              >
                <span>{s.display}</span>
                <small>{s.total} зак.</small>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="orderer-ac-wrap orderer-ac-filter" ref={wrapRef}>
      <User size={15} className="orderer-ac-icon" />
      <input
        className="input orderer-ac-input"
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || e.key === 'Enter') setOpen(false);
        }}
      />
      {value && (
        <button
          type="button"
          className="clear-input-btn"
          onClick={() => {
            onChange('');
            setOpen(false);
          }}
        >
          <X size={14} />
        </button>
      )}

      {open && suggestions.length > 0 && (
        <div className="orderer-ac-dropdown">
          {suggestions.map((s) => (
            <button
              key={s.key}
              type="button"
              className="orderer-ac-item"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s.display);
                setOpen(false);
              }}
            >
              <span>{s.display}</span>
              <small>{s.total}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
