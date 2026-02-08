'use client';

import { useState, useMemo } from 'react';
import { MATERIAL_ICONS, ICON_CATEGORIES } from '@/lib/material-icons';

interface MaterialIconPickerProps {
  selectedIcon: string | null;
  onSelectIcon: (iconName: string) => void;
  onClearIcon?: () => void;
}

export default function MaterialIconPicker({
  selectedIcon,
  onSelectIcon,
  onClearIcon,
}: MaterialIconPickerProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const filteredIcons = useMemo(() => {
    return MATERIAL_ICONS.filter((icon) => {
      const matchesCategory =
        activeCategory === 'All' || icon.category === activeCategory;
      if (!matchesCategory) return false;

      if (!search) return true;

      const term = search.toLowerCase();
      return (
        icon.name.includes(term) ||
        icon.label.toLowerCase().includes(term) ||
        icon.keywords.some((kw) => kw.includes(term))
      );
    });
  }, [search, activeCategory]);

  const selectedIconData = selectedIcon
    ? MATERIAL_ICONS.find((i) => i.name === selectedIcon)
    : null;

  return (
    <div>
      <label className="block text-sm font-medium text-[#435970] mb-2">
        Category Icon
      </label>

      {/* Selected icon display */}
      <div className="flex items-center gap-3 mb-3 p-3 bg-[#f8fbfe] border border-[#dfedfb] rounded-lg min-h-[56px]">
        {selectedIconData ? (
          <>
            <div className="w-10 h-10 bg-[#dfedfb] rounded-lg flex items-center justify-center flex-shrink-0">
              <span
                className="material-icons text-[#435970]"
                style={{ fontSize: '24px' }}
              >
                {selectedIconData.name}
              </span>
            </div>
            <span className="text-sm text-[#435970] font-medium">
              {selectedIconData.label}
            </span>
            {onClearIcon && (
              <button
                type="button"
                onClick={onClearIcon}
                className="ml-auto text-xs text-[#7895b3] hover:text-red-500 transition-colors"
              >
                Clear
              </button>
            )}
          </>
        ) : (
          <span className="text-sm text-[#7895b3]">No icon selected</span>
        )}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search icons..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2 mb-3 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3] text-sm"
      />

      {/* Category tabs */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-thin">
        <button
          type="button"
          onClick={() => setActiveCategory('All')}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            activeCategory === 'All'
              ? 'bg-[#435970] text-white'
              : 'bg-[#dfedfb] text-[#435970] hover:bg-[#7895b3] hover:text-white'
          }`}
        >
          All
        </button>
        {ICON_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-[#435970] text-white'
                : 'bg-[#dfedfb] text-[#435970] hover:bg-[#7895b3] hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Icon grid */}
      <div className="max-h-[280px] overflow-y-auto border border-[#dfedfb] rounded-lg p-2 bg-white">
        {filteredIcons.length === 0 ? (
          <p className="text-sm text-[#7895b3] text-center py-6">
            No icons found
          </p>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {filteredIcons.map((icon) => (
              <button
                key={icon.name}
                type="button"
                onClick={() => onSelectIcon(icon.name)}
                title={icon.label}
                className={`w-full aspect-square flex items-center justify-center rounded-lg transition-all ${
                  selectedIcon === icon.name
                    ? 'bg-[#435970] text-white ring-2 ring-[#435970] ring-offset-1'
                    : 'text-[#435970] hover:bg-[#dfedfb]'
                }`}
              >
                <span
                  className="material-icons"
                  style={{ fontSize: '22px' }}
                >
                  {icon.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-[#7895b3] mt-1.5">
        {filteredIcons.length} icon{filteredIcons.length !== 1 ? 's' : ''} available
      </p>
    </div>
  );
}
