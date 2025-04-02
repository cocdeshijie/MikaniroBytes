"use client";

import React, { createContext, useContext, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

interface ScrollContextProps {
    handleScrollTo: (url: string) => void;
}

interface ScrollHistoryState {
    scrollPosition: number;
    pathname: string;
}

export const ScrollContext = createContext<ScrollContextProps | undefined>(undefined);

export const ScrollProvider = ({ children }: { children: React.ReactNode }) => {
    const pathname = usePathname();
    const scrollbarThumbRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number>();
    const isRestoringScroll = useRef(false);
    const isHistoryNavigation = useRef(false);
    const isInitialLoad = useRef(true);

    const updateScrollbarThumb = useCallback(() => {
        if (!scrollbarThumbRef.current || typeof window === 'undefined') return;

        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrolled = window.scrollY;

        // Calculate dimensions
        const thumbHeight = Math.max((windowHeight / documentHeight) * windowHeight, 40);
        const scrollRange = documentHeight - windowHeight;
        const thumbPosition = scrollRange > 0 ? (scrolled / scrollRange) * (windowHeight - thumbHeight) : 0;

        // Apply changes
        const thumb = scrollbarThumbRef.current.style;
        thumb.height = `${thumbHeight}px`;
        thumb.transform = `translateY(${thumbPosition}px)`;
    }, []);

    // Save scroll position to history state
    const saveScrollPosition = useCallback(() => {
        if (isHistoryNavigation.current) return;

        const currentState = history.state || {};
        const newState: ScrollHistoryState = {
            ...currentState,
            scrollPosition: window.scrollY,
            pathname
        };

        // Replace the current history entry with updated scroll position
        history.replaceState(newState, '');

        // Also save to localStorage as backup
        localStorage.setItem(`scrollPosition-${pathname}`, window.scrollY.toString());
    }, [pathname]);

    // Handle popstate (back/forward navigation)
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            isHistoryNavigation.current = true;
            const state = event.state as ScrollHistoryState;

            if (state?.scrollPosition !== undefined && state.pathname === pathname) {
                isRestoringScroll.current = true;
                window.scrollTo(0, state.scrollPosition);
                updateScrollbarThumb();
                setTimeout(() => {
                    isRestoringScroll.current = false;
                    isHistoryNavigation.current = false;
                }, 100);
            } else {
                // Fallback to localStorage if history state is missing
                const savedPosition = localStorage.getItem(`scrollPosition-${pathname}`);
                if (savedPosition !== null) {
                    window.scrollTo(0, parseInt(savedPosition));
                    updateScrollbarThumb();
                }
                setTimeout(() => {
                    isHistoryNavigation.current = false;
                }, 100);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [pathname, updateScrollbarThumb]);

    // Save scroll position before unload
    useEffect(() => {
        window.addEventListener('beforeunload', saveScrollPosition);
        return () => window.removeEventListener('beforeunload', saveScrollPosition);
    }, [saveScrollPosition]);

    // Save scroll position periodically and on pathname change
    useEffect(() => {
        if (isRestoringScroll.current || isHistoryNavigation.current) return;

        const scrollTimeout = setInterval(saveScrollPosition, 1000);

        return () => {
            clearInterval(scrollTimeout);
            if (!isInitialLoad.current) {
                saveScrollPosition();
            }
        };
    }, [pathname, saveScrollPosition]);

    // Handle page changes and initial load
    useEffect(() => {
        if (isRestoringScroll.current || isHistoryNavigation.current) return;

        if (isInitialLoad.current) {
            // Handle initial page load
            const restoreScrollPosition = () => {
                // Try to get position from history state first
                const state = history.state as ScrollHistoryState;
                if (state?.scrollPosition !== undefined && state.pathname === pathname) {
                    window.scrollTo(0, state.scrollPosition);
                    updateScrollbarThumb();
                    return;
                }

                // Fallback to localStorage
                const savedPosition = localStorage.getItem(`scrollPosition-${pathname}`);
                if (savedPosition !== null) {
                    window.scrollTo(0, parseInt(savedPosition));
                    updateScrollbarThumb();
                    localStorage.removeItem(`scrollPosition-${pathname}`);
                }
            };

            // Wait for content to be rendered
            const timeout = setTimeout(() => {
                restoreScrollPosition();
                isInitialLoad.current = false;
            }, 100);

            return () => clearTimeout(timeout);
        } else {
            // Update scrollbar after content changes without resetting position
            const timeout = setTimeout(() => {
                updateScrollbarThumb();
            }, 100);

            return () => clearTimeout(timeout);
        }
    }, [pathname, updateScrollbarThumb]);

    // Setup scroll and resize handlers
    useEffect(() => {
        const onScroll = () => {
            if (rafRef.current) return;
            rafRef.current = requestAnimationFrame(() => {
                updateScrollbarThumb();
                rafRef.current = undefined;
            });
        };

        const resizeObserver = new ResizeObserver(() => {
            if (rafRef.current) return;
            rafRef.current = requestAnimationFrame(() => {
                updateScrollbarThumb();
                rafRef.current = undefined;
            });
        });

        // Add listeners
        window.addEventListener('scroll', onScroll, { passive: true });
        resizeObserver.observe(document.body);

        // Initial update
        const initTimeout = setTimeout(updateScrollbarThumb, 100);

        return () => {
            window.removeEventListener('scroll', onScroll);
            resizeObserver.disconnect();
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            clearTimeout(initTimeout);
        };
    }, [updateScrollbarThumb]);

    const handleScrollTo = (url: string) => {
        const targetId = url.substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
            const topOffset = window.innerHeight * 0.15;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.scrollY - topOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: "smooth",
            });
        }
    };

    return (
        <ScrollContext.Provider value={{ handleScrollTo }}>
            <div className="custom-scrollbar">
                <div
                    ref={scrollbarThumbRef}
                    className="absolute top-0 left-0 right-0 bg-current rounded"
                    style={{
                        backgroundColor: 'var(--scrollbar)',
                        transition: 'height 0.5s ease-out, transform 0.3s ease-out'
                    }}
                />
            </div>
            {children}
        </ScrollContext.Provider>
    );
};

export const useScroll = () => {
    const context = useContext(ScrollContext);
    if (!context) {
        throw new Error("useScroll must be used within a ScrollProvider");
    }
    return context;
};