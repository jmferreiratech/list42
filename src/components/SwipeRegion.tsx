import { Box } from "@mui/material";
import { TouchEvent, useRef } from 'react';

export function HorizontalSwipeRegion({children, onChange}: {children: React.ReactElement, onChange: (val: 'left'|'right') => void}) {
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);
    const minSwipeDistance = 50;

    const handleTouchStart = (e: TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const handleTouchMove = (e: TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return;

        const distance = touchStartX.current - touchEndX.current;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            onChange('left');
        } else if (isRightSwipe) {
            onChange('right');
        }

        touchStartX.current = null;
        touchEndX.current = null;
    };

    return (
        <Box
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {children}
        </Box>
    )
}
