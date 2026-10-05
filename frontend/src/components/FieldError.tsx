import React from 'react';

export const FieldError: React.FC<{ id?: string; message?: string }> = ({ id, message }) => {
  if (!message) return null;
  return <p id={id} role="alert" className="mt-1.5 text-xs font-semibold text-rose-600">{message}</p>;
};
