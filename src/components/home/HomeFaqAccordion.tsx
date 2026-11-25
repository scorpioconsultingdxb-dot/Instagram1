'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export interface FaqItem {
  question: string;
  answer: string;
}

export function HomeFaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        const panelId = `home-faq-panel-${idx}`;
        const buttonId = `home-faq-btn-${idx}`;
        return (
          <div
            key={item.question}
            className="viewora-card overflow-hidden rounded-2xl transition hover:border-[#7957FF]/40"
          >
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="flex w-full items-center justify-between gap-3 p-5 text-left"
              >
                <span>{item.question}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[#6941EF] transition-transform duration-150 dark:text-[#A99AFF] ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
            </h3>
            {isOpen ? (
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className="border-t border-slate-100 px-5 py-4 text-xs leading-relaxed text-[#64748B] dark:border-[#263047] dark:text-[#94A3B8]"
              >
                {item.answer}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
