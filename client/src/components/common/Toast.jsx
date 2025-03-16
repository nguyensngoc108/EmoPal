import React, { useEffect } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { XMarkIcon } from '@heroicons/react/24/solid';

export const Toast = ({ message, type = 'info', duration = 5000, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-400" aria-hidden="true" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />;
      case 'warning':
        return <ExclamationCircleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />;
      default:
        return <InformationCircleIcon className="h-5 w-5 text-blue-400" aria-hidden="true" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50';
      case 'error':
        return 'bg-red-50';
      case 'warning':
        return 'bg-yellow-50';
      default:
        return 'bg-blue-50';
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'border-green-400';
      case 'error':
        return 'border-red-400';
      case 'warning':
        return 'border-yellow-400';
      default:
        return 'border-blue-400';
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'success':
        return 'text-green-800';
      case 'error':
        return 'text-red-800';
      case 'warning':
        return 'text-yellow-800';
      default:
        return 'text-blue-800';
    }
  };

  return (
    <div className="fixed top-20 right-4 z-50">
      <div
        className={`${getBgColor()} ${getTextColor()} ${getBorderColor()} border-l-4 p-4 rounded shadow-lg max-w-md`}
        role="alert"
      >
        <div className="flex">
          <div className="flex-shrink-0">{getIcon()}</div>
          <div className="ml-3 flex-1 md:flex md:justify-between">
            <p className="text-sm">{message}</p>
            <button
              type="button"
              className="ml-3 flex-shrink-0 inline-flex"
              onClick={onClose}
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};