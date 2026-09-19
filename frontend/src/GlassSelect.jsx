import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

export const CATEGORY_OPTIONS = [
  { value: 'Breakfast', label: 'Breakfast' },
  { value: 'Lunch', label: 'Lunch' },
  { value: 'Dinner', label: 'Dinner' },
  { value: 'Groceries', label: 'Groceries' },
  { value: 'Transport', label: 'Transport' },
  { value: 'Shopping', label: 'Shopping' },
  { value: 'Bills & Utilities', label: 'Bills & Utilities' },
  { value: 'Other', label: 'Other' },
];

export default function GlassSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  error = false,
  id,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedby,
  disabled = false,
  className = '',
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);

  const normalizedOptions = options.map(opt => 
    typeof opt === 'object' ? opt : { value: opt, label: opt }
  );

  const selectedOption = normalizedOptions.find(opt => String(opt.value) === String(value));

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = Math.min(normalizedOptions.length * 42 + 16, 260);
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;

      setMenuStyle({
        position: 'fixed',
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        top: openUp ? 'auto' : `${rect.bottom + 6}px`,
        bottom: openUp ? `${window.innerHeight - rect.top + 6}px` : 'auto',
        zIndex: 9999999,
        background: 'rgba(255, 255, 255, 0.65)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.75)',
        borderRadius: '14px',
        boxShadow: '0 16px 40px rgba(24, 34, 56, 0.16), 0 4px 12px rgba(24, 34, 56, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        padding: '6px',
        maxHeight: '260px',
        overflowY: 'auto',
        animation: 'fadeInSelect 0.15s ease-out'
      });
    }
  };

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(prev => !prev);
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);

      const handleClickOutside = (event) => {
        if (
          containerRef.current && !containerRef.current.contains(event.target) &&
          !event.target.closest('.glass-select-menu')
        ) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);

      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const idx = normalizedOptions.findIndex(opt => String(opt.value) === String(value));
      setFocusedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, value]);

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setFocusedIndex(prev => (prev < normalizedOptions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : normalizedOptions.length - 1));
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else if (focusedIndex >= 0 && focusedIndex < normalizedOptions.length) {
        onChange(normalizedOptions[focusedIndex].value);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    } else if (e.key === 'Tab') {
      if (isOpen) {
        setIsOpen(false);
      }
    }
  };

  const handleSelect = (optValue) => {
    onChange(optValue);
    setIsOpen(false);
  };

  return (
    <div 
      ref={containerRef}
      className={`glass-select-container ${className}`}
      style={{ position: 'relative', width: '100%', ...style }}
    >
      <div
        ref={triggerRef}
        id={id}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
        onClick={toggleOpen}
        onKeyDown={handleKeyDown}
        className={`glass-select-trigger ${error ? 'input-error' : ''} ${isOpen ? 'open' : ''}`}
        style={{
          width: '100%',
          padding: '13px 16px',
          border: error ? '1px solid var(--danger)' : isOpen ? '1px solid var(--accent)' : '1px solid var(--border-input)',
          borderRadius: '12px',
          fontSize: '15px',
          fontWeight: 500,
          background: isOpen ? '#ffffff' : 'var(--surface-input)',
          color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)',
          boxShadow: isOpen 
            ? '0 0 0 3px var(--focus)' 
            : error 
              ? '0 0 0 3px rgba(200, 95, 112, 0.15)' 
              : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span 
          style={{ 
            fontSize: '12px', 
            color: 'var(--text-muted)', 
            marginLeft: '10px',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            display: 'inline-block'
          }}
        >
          ▾
        </span>
      </div>

      {isOpen && ReactDOM.createPortal(
        <div
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="glass-select-menu"
          style={menuStyle}
        >
          {normalizedOptions.map((opt, index) => {
            const isSelected = String(opt.value) === String(value);
            const isFocused = index === focusedIndex;

            return (
              <div
                key={String(opt.value)}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setFocusedIndex(index)}
                className={`glass-select-option ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''}`}
                style={{
                  padding: '11px 14px',
                  borderRadius: '9px',
                  fontSize: '14.5px',
                  fontWeight: isSelected ? 600 : 500,
                  color: 'var(--text-primary)',
                  background: isSelected 
                    ? 'rgba(93, 120, 232, 0.18)' 
                    : isFocused 
                      ? 'rgba(93, 120, 232, 0.08)' 
                      : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background 0.12s ease',
                  userSelect: 'none',
                  marginBottom: index === normalizedOptions.length - 1 ? 0 : '2px'
                }}
              >
                <span>{opt.label}</span>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
