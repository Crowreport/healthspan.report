"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./Carousel.module.css";

interface CarouselProps {
  children: React.ReactNode;
}

export default function Carousel({ children }: CarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const childrenArray = Array.isArray(children) ? children : [children];
  
  if (childrenArray.length === 0) return null;

  // Duplicate items to create seamless infinite loop
  // We need at least 18 items total, so duplicate until we have enough
  const minItems = 18;
  const duplicatedItems: React.ReactNode[] = [];
  while (duplicatedItems.length < minItems) {
    duplicatedItems.push(...childrenArray);
  }
  const displayItems = duplicatedItems.slice(0, minItems);

  // Calculate item width and gap
  const getItemWidth = () => {
    const itemsContainer = itemsContainerRef.current;
    if (!itemsContainer || itemsContainer.children.length === 0) return 0;
    const firstChild = itemsContainer.children[0] as HTMLElement;
    return firstChild.offsetWidth || 0;
  };

  const getGap = () => {
    const itemsContainer = itemsContainerRef.current;
    if (!itemsContainer || itemsContainer.children.length < 2) return 16;
    const firstChild = itemsContainer.children[0] as HTMLElement;
    const secondChild = itemsContainer.children[1] as HTMLElement;
    const gap = secondChild.offsetLeft - firstChild.offsetLeft - firstChild.offsetWidth;
    return gap || 16;
  };

  const updateScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Set initial scroll position to start of first set
    container.scrollLeft = 0;
    updateScrollButtons();

    const handleScroll = () => {
      const itemWidth = getItemWidth();
      const gap = getGap();
      const singleSetWidth = itemWidth * childrenArray.length + gap * (childrenArray.length - 1);

      // Reset scroll position when we've scrolled past one complete set
      // This creates the seamless infinite loop effect
      if (container.scrollLeft >= singleSetWidth) {
        container.scrollLeft = container.scrollLeft - singleSetWidth;
      } else if (container.scrollLeft < 0) {
        container.scrollLeft = singleSetWidth + container.scrollLeft;
      }

      updateScrollButtons();
    };

    container.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", updateScrollButtons);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [childrenArray.length]);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const itemWidth = getItemWidth();
    const gap = getGap();
    const scrollAmount = itemWidth + gap;

    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <div className={styles.carousel}>
      <div ref={scrollContainerRef} className={styles.scrollContainer}>
        <div ref={itemsContainerRef} className={styles.items}>
          {/* First set of items */}
          {displayItems.map((child, index) => (
            <div key={`set1-${index}`} className={styles.item}>
              {child}
            </div>
          ))}
          {/* Duplicate set for seamless loop */}
          {displayItems.map((child, index) => (
            <div key={`set2-${index}`} className={styles.item}>
              {child}
            </div>
          ))}
        </div>
      </div>

      <button
        className={`${styles.navButton} ${styles.prev}`}
        onClick={() => scroll("left")}
        aria-label="Previous items"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <button
        className={`${styles.navButton} ${styles.next}`}
        onClick={() => scroll("right")}
        aria-label="Next items"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
