import React from 'react';

interface WastoMarkProps {
  size?: 'sm' | 'md';
  showWordmark?: boolean;
  subtitle?: string;
}

export const WastoMark: React.FC<WastoMarkProps> = ({
  size = 'md',
  showWordmark = true,
  subtitle,
}) => {
  const iconBox = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
  const textSize = size === 'sm' ? 'text-[17px]' : 'text-[19px]';

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <div
        className={`${iconBox} rounded-[8px] bg-[#245C3B] text-white flex items-center justify-center shrink-0`}
        aria-hidden="true"
      >
        <svg
          width={size === 'sm' ? 16 : 18}
          height={size === 'sm' ? 16 : 18}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.5 7.5H19.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M6.5 7.5L8.1 18.2C8.2 19.1 9 19.8 9.9 19.8H14.1C15 19.8 15.8 19.1 15.9 18.2L17.5 7.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path
            d="M9 11.2L10.6 15.4L12 12.2L13.4 15.4L15 11.2"
            stroke="#D9E8AA"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 4.8H14.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span className={`${textSize} font-semibold tracking-[-0.02em] text-[#18251D]`}>
            Wasto
          </span>
          {subtitle && (
            <span className="text-[11px] font-medium text-[#526158] mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
