import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronsUpDown, Search, Check, X } from 'lucide-react';

export interface ComboboxOption {
	value: number | string;
	label: string;
	code?: string;
	sublabel?: string;
}

export interface ComboboxProps {
	label?: string;
	required?: boolean;
	placeholder?: string;
	searchPlaceholder?: string;
	emptyMessage?: string;
	value: number | string | '';
	onChange: (value: number | string) => void;
	options: ComboboxOption[];
	disabled?: boolean;
	error?: string;
	helperText?: string;
	id?: string;
	className?: string;
}

export const Combobox: React.FC<ComboboxProps> = ({
	label,
	required,
	placeholder = 'Pilih opsi...',
	searchPlaceholder = 'Cari...',
	emptyMessage = 'Tidak ada hasil ditemukan',
	value,
	onChange,
	options,
	disabled = false,
	error,
	helperText,
	id,
	className = ''
}) => {
	const generatedId = useId();
	const comboboxId = id ?? (label ? `combobox-${label.toLowerCase().replace(/\s+/g, '-')}` : generatedId);

	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [highlightedIndex, setHighlightedIndex] = useState(-1);

	const containerRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	// Temukan opsi terpilih saat ini
	const selectedOption = options.find((opt) => String(opt.value) === String(value));

	// Filter opsi berdasarkan search query
	const filteredOptions = options.filter((opt) => {
		if (!searchQuery.trim()) return true;
		const query = searchQuery.toLowerCase().trim();
		const matchLabel = opt.label.toLowerCase().includes(query);
		const matchCode = opt.code ? opt.code.toLowerCase().includes(query) : false;
		const matchSublabel = opt.sublabel ? opt.sublabel.toLowerCase().includes(query) : false;
		return matchLabel || matchCode || matchSublabel;
	});

	// Fokus otomatis pada input pencarian saat popover terbuka
	useEffect(() => {
		if (isOpen) {
			setHighlightedIndex(-1);
			const timer = setTimeout(() => {
				searchInputRef.current?.focus();
			}, 50);
			return () => clearTimeout(timer);
		} else {
			setSearchQuery('');
			setHighlightedIndex(-1);
		}
	}, [isOpen]);

	// Click outside listener yang mendukung Shadow DOM boundary
	useEffect(() => {
		if (!isOpen) return;

		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current) {
				const path = event.composedPath ? event.composedPath() : [];
				if (path.length > 0) {
					if (!path.includes(containerRef.current)) {
						setIsOpen(false);
					}
				} else if (!containerRef.current.contains(event.target as Node)) {
					setIsOpen(false);
				}
			}
		};

		document.addEventListener('mousedown', handleClickOutside, true);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside, true);
		};
	}, [isOpen]);

	const handleSelect = (option: ComboboxOption) => {
		onChange(option.value);
		setIsOpen(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (disabled) return;

		if (!isOpen) {
			if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
				e.preventDefault();
				setIsOpen(true);
			}
			return;
		}

		if (e.key === 'Escape') {
			e.preventDefault();
			setIsOpen(false);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
				handleSelect(filteredOptions[highlightedIndex]);
			}
		}
	};

	// Scroll highlighted item into view
	useEffect(() => {
		if (highlightedIndex >= 0 && listRef.current) {
			const items = listRef.current.querySelectorAll('.k-combobox-item');
			const targetItem = items[highlightedIndex] as HTMLElement | undefined;
			if (targetItem && typeof targetItem.scrollIntoView === 'function') {
				targetItem.scrollIntoView({ block: 'nearest' });
			}
		}
	}, [highlightedIndex]);

	return (
		<div className={`sp-field k-field ${className}`.trim()} ref={containerRef}>
			{label && (
				<label htmlFor={comboboxId} className="sp-label k-label">
					{label}
					{required && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
				</label>
			)}

			<div className="k-combobox-wrapper" onKeyDown={handleKeyDown}>
				<select
					id={comboboxId}
					aria-label={label ?? 'Project'}
					value={value}
					required={required}
					disabled={disabled}
					tabIndex={-1}
					className="k-combobox-native-select"
					style={{
						position: 'absolute',
						width: '1px',
						height: '1px',
						padding: 0,
						margin: '-1px',
						overflow: 'hidden',
						clip: 'rect(0, 0, 0, 0)',
						whiteSpace: 'nowrap',
						border: 0,
						opacity: 0,
						pointerEvents: 'none'
					}}
					onChange={(e) => {
						const raw = e.target.value;
						onChange(raw ? (!isNaN(Number(raw)) ? Number(raw) : raw) : '');
					}}
				>
					<option value="">{placeholder}</option>
					{options.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>

				<button
					type="button"
					aria-label={label ?? 'Pilih project'}
					aria-expanded={isOpen}
					aria-haspopup="listbox"
					disabled={disabled}
					className={`k-combobox-trigger ${isOpen ? 'open' : ''}`}
					style={error ? { borderColor: '#ef4444' } : undefined}
					onClick={() => setIsOpen((prev) => !prev)}
				>
					<span className="k-combobox-value">
						{selectedOption ? (
							<>
								<span>{selectedOption.label}</span>
								{selectedOption.code && (
									<span className="k-combobox-badge">{selectedOption.code}</span>
								)}
							</>
						) : (
							<span className="k-combobox-placeholder">{placeholder}</span>
						)}
					</span>
					<span className="k-combobox-icon">
						<ChevronsUpDown size={15} />
					</span>
				</button>

				{isOpen && (
					<div className="k-combobox-popover" role="dialog" aria-modal="false">
						<div className="k-combobox-search">
							<span className="k-combobox-search-icon">
								<Search size={14} />
							</span>
							<input
								ref={searchInputRef}
								type="text"
								className="k-combobox-search-input"
								placeholder={searchPlaceholder}
								value={searchQuery}
								onChange={(e) => {
									setSearchQuery(e.target.value);
									setHighlightedIndex(0);
								}}
							/>
							{searchQuery && (
								<button
									type="button"
									className="k-combobox-search-clear"
									title="Hapus pencarian"
									aria-label="Hapus pencarian"
									onClick={() => {
										setSearchQuery('');
										searchInputRef.current?.focus();
									}}
								>
									<X size={13} />
								</button>
							)}
						</div>

						<div className="k-combobox-list" role="listbox" ref={listRef}>
							{filteredOptions.length > 0 ? (
								filteredOptions.map((option, idx) => {
									const isSelected = String(option.value) === String(value);
									const isHighlighted = idx === highlightedIndex;

									return (
										<div
											key={option.value}
											role="option"
											aria-selected={isSelected}
											className={`k-combobox-item ${isSelected ? 'selected' : ''} ${
												isHighlighted ? 'highlighted' : ''
											}`}
											onClick={() => handleSelect(option)}
											onMouseEnter={() => setHighlightedIndex(idx)}
										>
											<div className="k-combobox-item-left">
												<span>{option.label}</span>
												{option.code && (
													<span className="k-combobox-badge">{option.code}</span>
												)}
											</div>
											{isSelected && (
												<span className="k-combobox-item-check">
													<Check size={14} />
												</span>
											)}
										</div>
									);
								})
							) : (
								<div className="k-combobox-empty">{emptyMessage}</div>
							)}
						</div>
					</div>
				)}
			</div>

			{error ? (
				<span style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>{error}</span>
			) : helperText ? (
				<span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{helperText}</span>
			) : null}
		</div>
	);
};
