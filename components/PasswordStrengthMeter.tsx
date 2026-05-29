'use client';

import React from 'react';

interface CriteriaItem {
  label: string;
  met: boolean;
}

interface PasswordStrengthMeterProps {
  password: string;
}

export default function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const criteria: CriteriaItem[] = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Contains a number (0-9)', met: /\d/.test(password) },
    { label: 'Contains lowercase letter (a-z)', met: /[a-z]/.test(password) },
    { label: 'Contains uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'Contains special character (!@#$%^&*)', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const metCount = criteria.filter((c) => c.met).length;

  const getStrengthLabel = () => {
    if (!password) return { label: 'Empty', colorClass: 'bg-zinc-800 text-zinc-400', progressColor: 'bg-zinc-800', width: 'w-0' };
    if (metCount <= 1) return { label: 'Very Weak', colorClass: 'bg-red-500/20 text-red-400 border border-red-500/30', progressColor: 'bg-red-500', width: 'w-1/5' };
    if (metCount === 2) return { label: 'Weak', colorClass: 'bg-orange-500/20 text-orange-400 border border-orange-500/30', progressColor: 'bg-orange-500', width: 'w-2/5' };
    if (metCount === 3) return { label: 'Medium', colorClass: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', progressColor: 'bg-yellow-500', width: 'w-3/5' };
    if (metCount === 4) return { label: 'Strong', colorClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30', progressColor: 'bg-emerald-500', width: 'w-4/5' };
    return { label: 'Secure', colorClass: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30', progressColor: 'bg-indigo-500', width: 'w-full' };
  };

  const strength = getStrengthLabel();

  return (
    <div className="space-y-4">
      {/* Strength Indicator Header */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400 font-medium">Password Strength</span>
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all duration-300 ${strength.colorClass}`}>
          {strength.label}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-zinc-800/80 rounded-full overflow-hidden border border-zinc-700/30">
        <div 
          className={`h-full rounded-full transition-all duration-500 ease-out ${strength.progressColor} ${strength.width}`}
        />
      </div>

      {/* Checklist */}
      <ul className="space-y-2 text-xs text-zinc-400">
        {criteria.map((item, idx) => (
          <li key={idx} className="flex items-center space-x-2.5 transition-all duration-300">
            {item.met ? (
              <svg 
                className="w-4 h-4 text-emerald-400 shrink-0 transition-transform duration-300 scale-110" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full" />
              </div>
            )}
            <span className={`transition-colors duration-300 ${item.met ? 'text-zinc-200' : 'text-zinc-500'}`}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
