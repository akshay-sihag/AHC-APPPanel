'use client';

import { useEffect, useState } from 'react';

export type LogShotFormValues = {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  medicationName: string;
  nextDate: string; // YYYY-MM-DD or ''
};

type Mode = 'create' | 'edit';

interface LogShotFormModalProps {
  isOpen: boolean;
  mode: Mode;
  initialValues?: Partial<LogShotFormValues>;
  onClose: () => void;
  onSubmit: (values: LogShotFormValues) => Promise<void>;
}

const todayStr = () => new Date().toISOString().split('T')[0];

export default function LogShotFormModal({
  isOpen,
  mode,
  initialValues,
  onClose,
  onSubmit,
}: LogShotFormModalProps) {
  const [values, setValues] = useState<LogShotFormValues>({
    date: initialValues?.date || todayStr(),
    time: initialValues?.time || '09:00',
    medicationName: initialValues?.medicationName || '',
    nextDate: initialValues?.nextDate || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setValues({
        date: initialValues?.date || todayStr(),
        time: initialValues?.time || '09:00',
        medicationName: initialValues?.medicationName || '',
        nextDate: initialValues?.nextDate || '',
      });
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen, initialValues]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!values.date) {
      setError('Date is required.');
      return;
    }
    if (!values.time) {
      setError('Time is required.');
      return;
    }
    if (!values.medicationName.trim()) {
      setError('Medication name is required.');
      return;
    }
    if (values.nextDate && values.nextDate < values.date) {
      setError('Next dose date cannot be before the log date.');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        ...values,
        medicationName: values.medicationName.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save log entry.');
      setSubmitting(false);
    }
  };

  const title = mode === 'create' ? 'Add Medication Log (Backfill)' : 'Edit Medication Log';
  const submitLabel = mode === 'create' ? 'Add Log' : 'Save Changes';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="px-6 py-4 border-b border-[#dfedfb] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#435970]">{title}</h3>
            <p className="text-xs text-[#7895b3] mt-0.5">
              {mode === 'create'
                ? 'Record a historical medication shot on behalf of the customer.'
                : 'Update an existing medication log entry.'}
            </p>
          </div>
          {!submitting && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#435970] mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  max={todayStr()}
                  value={values.date}
                  onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#dfedfb] rounded-lg text-sm text-[#435970] focus:outline-none focus:ring-2 focus:ring-[#435970]/30 focus:border-[#435970]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#435970] mb-1">
                  Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={values.time}
                  onChange={(e) => setValues((v) => ({ ...v, time: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#dfedfb] rounded-lg text-sm text-[#435970] focus:outline-none focus:ring-2 focus:ring-[#435970]/30 focus:border-[#435970]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#435970] mb-1">
                Medication Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Semaglutide 0.5mg"
                value={values.medicationName}
                onChange={(e) => setValues((v) => ({ ...v, medicationName: e.target.value }))}
                className="w-full px-3 py-2 border border-[#dfedfb] rounded-lg text-sm text-[#435970] focus:outline-none focus:ring-2 focus:ring-[#435970]/30 focus:border-[#435970]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#435970] mb-1">
                Next Scheduled Dose <span className="text-[#7895b3] font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={values.nextDate}
                onChange={(e) => setValues((v) => ({ ...v, nextDate: e.target.value }))}
                className="w-full px-3 py-2 border border-[#dfedfb] rounded-lg text-sm text-[#435970] focus:outline-none focus:ring-2 focus:ring-[#435970]/30 focus:border-[#435970]"
              />
              <p className="text-xs text-[#7895b3] mt-1">
                Reminder notifications are not sent for backfilled historical entries.
              </p>
            </div>

            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-[#dfedfb] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-[#dfedfb] text-[#435970] rounded-lg font-medium hover:bg-[#dfedfb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
