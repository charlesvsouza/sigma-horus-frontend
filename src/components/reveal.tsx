'use client';

import { ReactNode, useEffect, useRef } from 'react';

interface Props {
  children: ReactNode;
  as?: 'section' | 'div';
  stagger?: boolean;
  className?: string;
}

export function Reveal({ children, as: Tag = 'div', stagger, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (stagger) {
            el.querySelectorAll<HTMLElement>('.animate-stagger').forEach((child, i) => {
              child.style.setProperty('--i', String(i));
              child.classList.add('revealed');
            });
          }
          el.classList.add('revealed');
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [stagger]);

  return (
    <Tag ref={ref} className={`${stagger ? '' : 'animate-reveal'} ${className}`}>
      {children}
    </Tag>
  );
}
