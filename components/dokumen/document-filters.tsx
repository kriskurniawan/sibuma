"use client";

import { Search, X } from "lucide-react";
import {
  useDebouncedFilterValue,
  useFilterNavigation,
} from "@/components/filters/use-filter-navigation";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

export function DocumentFilters({ search }: { search: string }) {
  const { isPending, navigate } = useFilterNavigation();
  const searchState = useDebouncedFilterValue(search, (value) =>
    navigate({ search: value }),
  );

  return (
    <InputGroup>
      <InputGroupAddon>
        <Search aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={searchState.text}
        onChange={(event) => searchState.change(event.target.value)}
        onFocus={searchState.onFocus}
        onBlur={searchState.onBlur}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            searchState.commitNow(event.currentTarget.value);
          }
        }}
        placeholder="Cari nama dokumen, keterangan, atau berkas…"
        aria-label="Cari dokumen kerja"
        aria-busy={isPending}
      />
      {searchState.text && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label="Hapus pencarian"
            onClick={() => {
              searchState.reset();
              searchState.commitNow("");
            }}
          >
            <X aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
