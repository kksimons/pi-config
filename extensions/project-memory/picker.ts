import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Input, Key, SelectList, Text, fuzzyFilter, matchesKey } from "@earendil-works/pi-tui";
import type { SelectItem } from "@earendil-works/pi-tui";

export interface PickerOptions {
	title: string;
	multi: boolean;
	hint: string;
	subtitle?: string;
	detail?: (item: SelectItem) => string;
	reorderable?: boolean;
	onMove?: (item: SelectItem, direction: "up" | "down") => SelectItem[];
	favoritable?: boolean;
	onFavorite?: (item: SelectItem) => SelectItem[];
	isFavorite?: (value: string) => boolean;
}

export async function openPicker(
	ctx: ExtensionContext,
	items: SelectItem[],
	options: PickerOptions,
): Promise<string[] | undefined> {
	if (!ctx.hasUI || items.length === 0) return undefined;
	const theme = ctx.ui.theme;
	const listTheme = {
		selectedPrefix: (text: string) => theme.fg("accent", text),
		selectedText: (text: string) => theme.fg("accent", text),
		description: (text: string) => theme.fg("muted", text),
		scrollInfo: (text: string) => theme.fg("dim", text),
		noMatch: (text: string) => theme.fg("warning", text),
	};

	const input = new Input();
	const selected = new Set<string>();
	let current = [...items];

	function decorate(item: SelectItem): SelectItem {
		const favorite = options.isFavorite?.(item.value) ? "★ " : "";
		const checked = selected.has(item.value) ? "✓ " : "";
		return favorite || checked ? { ...item, label: checked + favorite + item.label } : item;
	}

	function cleanLabel(value: string): string {
		return current.find((item) => item.value === value)?.label ?? value;
	}

	function buildList(preferredValue?: string): SelectList {
		const query = input.getValue().trim();
		const matched = query ? fuzzyFilter(current, query, (item) => item.label) : current;
		const view = matched.map(decorate);
		const next = new SelectList(view, Math.min(10, Math.max(1, view.length)), listTheme);
		const preferredIndex = preferredValue ? view.findIndex((item) => item.value === preferredValue) : -1;
		next.setSelectedIndex(Math.max(0, preferredIndex));
		return next;
	}

	let list = buildList();

	return ctx.ui.custom<string[] | undefined>((tui, _theme, _keyboard, done) => {
		const title = new Text(theme.fg("accent", theme.bold(options.title)), 0, 0);
		const hint = new Text(theme.fg("dim", options.hint), 0, 0);
		return {
			render: (width: number) => {
				const chosen = [...selected];
				const selection = chosen.length
					? theme.fg("success", "Selected: ") + theme.fg("text", chosen.map(cleanLabel).join(", "))
					: theme.fg("dim", options.multi ? "(none yet — enter toggles, esc finishes)" : "(type to narrow, enter selects)");
				const lines: string[] = [];
				lines.push(...title.render(width));
				if (options.subtitle) lines.push(...new Text(theme.fg("dim", options.subtitle), 0, 0).render(width));
				lines.push(...new Text(selection, 0, 0).render(width));
				if (options.detail) {
					const highlighted = list.getSelectedItem();
					if (highlighted) lines.push(...new Text(theme.fg("accent", options.detail(highlighted)), 0, 0).render(width));
				}
				lines.push(...input.render(width));
				lines.push(...list.render(width));
				lines.push(...hint.render(width));
				return lines;
			},
			invalidate: () => { input.invalidate(); list.invalidate(); },
			handleInput: (data: string) => {
				if (matchesKey(data, Key.ctrl("c"))) {
					done(undefined);
					return;
				}
				if (matchesKey(data, Key.escape)) {
					done(options.multi && selected.size ? [...selected] : undefined);
					return;
				}
				if (matchesKey(data, Key.enter)) {
					const item = list.getSelectedItem();
					if (item) {
						if (options.multi) {
							if (selected.has(item.value)) selected.delete(item.value);
							else selected.add(item.value);
							input.setValue("");
							list = buildList(item.value);
						} else {
							done([item.value]);
						}
					} else if (options.multi && selected.size) {
						done([...selected]);
					}
					tui.requestRender();
					return;
				}
				if (matchesKey(data, Key.tab)) {
					const item = list.getSelectedItem();
					if (item) { input.setValue(cleanLabel(item.value)); list = buildList(item.value); }
					tui.requestRender();
					return;
				}
				if (options.reorderable && (matchesKey(data, Key.ctrl("up")) || matchesKey(data, Key.ctrl("down")))) {
					const item = list.getSelectedItem();
					if (item && options.onMove) {
						current = options.onMove(item, matchesKey(data, Key.ctrl("up")) ? "up" : "down") ?? current;
						list = buildList(item.value);
					}
					tui.requestRender();
					return;
				}
				if (options.favoritable && matchesKey(data, Key.ctrl("f"))) {
					const item = list.getSelectedItem();
					if (item && options.onFavorite) {
						current = options.onFavorite(item) ?? current;
						list = buildList(item.value);
					}
					tui.requestRender();
					return;
				}
				if (matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
					list.handleInput(data);
					tui.requestRender();
					return;
				}
				input.handleInput(data);
				list = buildList();
				tui.requestRender();
			},
		};
	}, { overlay: true });
}
