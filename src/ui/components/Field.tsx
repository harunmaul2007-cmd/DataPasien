// Isian formulir dengan label dan pesan kesalahan yang terhubung ke input
// melalui aria-describedby dan aria-invalid.

import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

interface FieldBaseProps {
  label: string;
  /** Pesan kesalahan validasi; kosong/undefined berarti valid. */
  error?: string | undefined;
  /** Teks bantuan opsional di bawah isian. */
  hint?: string | undefined;
}

function useFieldIds(id: string | undefined) {
  const auto = useId();
  const inputId = id ?? `field-${auto}`;
  return { inputId, errorId: `${inputId}-error`, hintId: `${inputId}-hint` };
}

function describedBy(hasHint: boolean, hasError: boolean, hintId: string, errorId: string): string | undefined {
  const ids = [hasHint ? hintId : null, hasError ? errorId : null].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

function FieldMessages(props: { hint?: string | undefined; error?: string | undefined; hintId: string; errorId: string }) {
  return (
    <>
      {props.hint ? (
        <span id={props.hintId} className="field__hint">
          {props.hint}
        </span>
      ) : null}
      {props.error ? (
        <span id={props.errorId} className="field__error">
          {props.error}
        </span>
      ) : null}
    </>
  );
}

export type TextFieldProps = FieldBaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'aria-invalid'>;

export function TextField({ label, error, hint, id, className, ...rest }: TextFieldProps): ReactNode {
  const { inputId, errorId, hintId } = useFieldIds(id);
  return (
    <div className={`field${className ? ` ${className}` : ''}`}>
      <label htmlFor={inputId} className="field__label">
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        className="field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(!!hint, !!error, hintId, errorId)}
      />
      <FieldMessages hint={hint} error={error} hintId={hintId} errorId={errorId} />
    </div>
  );
}

export type TextAreaFieldProps = FieldBaseProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'aria-invalid'>;

export function TextAreaField({ label, error, hint, id, className, ...rest }: TextAreaFieldProps): ReactNode {
  const { inputId, errorId, hintId } = useFieldIds(id);
  return (
    <div className={`field${className ? ` ${className}` : ''}`}>
      <label htmlFor={inputId} className="field__label">
        {label}
      </label>
      <textarea
        {...rest}
        id={inputId}
        className="field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(!!hint, !!error, hintId, errorId)}
      />
      <FieldMessages hint={hint} error={error} hintId={hintId} errorId={errorId} />
    </div>
  );
}

export type SelectFieldProps = FieldBaseProps &
  Omit<import('react').SelectHTMLAttributes<HTMLSelectElement>, 'aria-invalid'> & {
    children: ReactNode;
  };

export function SelectField({ label, error, hint, id, className, children, ...rest }: SelectFieldProps): ReactNode {
  const { inputId, errorId, hintId } = useFieldIds(id);
  return (
    <div className={`field${className ? ` ${className}` : ''}`}>
      <label htmlFor={inputId} className="field__label">
        {label}
      </label>
      <select
        {...rest}
        id={inputId}
        className="field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(!!hint, !!error, hintId, errorId)}
      >
        {children}
      </select>
      <FieldMessages hint={hint} error={error} hintId={hintId} errorId={errorId} />
    </div>
  );
}
