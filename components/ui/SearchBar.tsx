"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RSSAPIResponse } from "@/types/rss";
import {
  getSearchSuggestions,
  mapSourcesToSearchItems,
  type SearchItem,
} from "@/utils/searchUtils";
import styles from "./SearchBar.module.css";

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
}

export default function SearchBar({
  placeholder = "Search articles, topics, videos...",
  onSearch,
}: SearchBarProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [indexItems, setIndexItems] = useState<SearchItem[]>([]);
  const [isIndexLoading, setIsIndexLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(-1);

  const suggestions = useMemo(
    () => getSearchSuggestions(indexItems, query, 7),
    [indexItems, query]
  );

  const shouldShowNoResults =
    query.trim().length >= 2 && !isIndexLoading && suggestions.length === 0;

  const loadSearchIndex = useCallback(async () => {
    if (indexItems.length > 0 || isIndexLoading) {
      return;
    }

    setIsIndexLoading(true);

    try {
      const [articleResponse, videoResponse] = await Promise.all([
        fetch("/api/rss?type=article"),
        fetch("/api/rss?type=video"),
      ]);

      const nextItems: SearchItem[] = [];

      if (articleResponse.ok) {
        const payload = (await articleResponse.json()) as RSSAPIResponse;
        nextItems.push(...mapSourcesToSearchItems(payload.sources || [], "article"));
      }

      if (videoResponse.ok) {
        const payload = (await videoResponse.json()) as RSSAPIResponse;
        nextItems.push(...mapSourcesToSearchItems(payload.sources || [], "video"));
      }

      setIndexItems(nextItems);
    } catch (error) {
      console.error("Failed to preload search index:", error);
    } finally {
      setIsIndexLoading(false);
    }
  }, [indexItems.length, isIndexLoading]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setActiveSuggestionIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setActiveSuggestionIndex(-1);
  }, [query]);

  function navigateToSearch(rawQuery: string) {
    const trimmedQuery = rawQuery.trim();
    if (!trimmedQuery) return;

    if (onSearch) {
      onSearch(trimmedQuery);
      return;
    }

    router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
  }

  function handleSuggestionSelect(suggestion: SearchItem) {
    setQuery(suggestion.title);
    setIsDropdownOpen(false);
    setActiveSuggestionIndex(-1);
    navigateToSearch(suggestion.title);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
      handleSuggestionSelect(suggestions[activeSuggestionIndex]);
      return;
    }

    setIsDropdownOpen(false);
    setActiveSuggestionIndex(-1);
    navigateToSearch(query);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <form onSubmit={handleSubmit} className={styles.searchBar}>
        <svg
          className={styles.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            setIsDropdownOpen(true);
            void loadSearchIndex();
          }}
          onKeyDown={(event) => {
            if (!isDropdownOpen || suggestions.length === 0) {
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveSuggestionIndex((current) =>
                current < suggestions.length - 1 ? current + 1 : 0
              );
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveSuggestionIndex((current) =>
                current > 0 ? current - 1 : suggestions.length - 1
              );
              return;
            }

            if (event.key === "Escape") {
              setIsDropdownOpen(false);
              setActiveSuggestionIndex(-1);
            }
          }}
          placeholder={placeholder}
          className={styles.input}
          aria-controls="search-suggestions-list"
          aria-autocomplete="list"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setActiveSuggestionIndex(-1);
              setIsDropdownOpen(false);
            }}
            className={styles.clearButton}
            aria-label="Clear search"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </form>

      {isDropdownOpen && (suggestions.length > 0 || shouldShowNoResults || isIndexLoading) && (
        <div className={styles.dropdown} id="search-suggestions-list" role="listbox">
          {isIndexLoading && (
            <p className={styles.dropdownStatus}>Loading suggestions...</p>
          )}

          {!isIndexLoading &&
            suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.type}-${suggestion.id}-${index}`}
                type="button"
                role="option"
                aria-selected={activeSuggestionIndex === index}
                className={`${styles.suggestion} ${
                  activeSuggestionIndex === index ? styles.suggestionActive : ""
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSuggestionSelect(suggestion)}
              >
                <span className={styles.suggestionTitle}>{suggestion.title}</span>
                <span className={styles.suggestionMeta}>
                  {suggestion.type === "article" ? "Article" : "Video"} - {suggestion.sourceName}
                </span>
              </button>
            ))}

          {!isIndexLoading && shouldShowNoResults && (
            <p className={styles.dropdownStatus}>No suggestions found.</p>
          )}
        </div>
      )}
    </div>
  );
}
