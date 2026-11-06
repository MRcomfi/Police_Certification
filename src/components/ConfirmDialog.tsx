import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  /** Подтверждение необратимого действия — кнопка красного цвета. */
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Модальный диалог подтверждения на основе нативного <dialog>: фокус внутри, Esc — отмена. */
export function ConfirmDialog({
  open,
  title,
  children,
  cancelLabel,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // По умолчанию фокус на безопасном действии.
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClose={() => {
        if (open) onCancel();
      }}
    >
      <h2 id={titleId} className="dialog__title">
        {title}
      </h2>
      <div id={bodyId} className="dialog__body">
        {children}
      </div>
      <div className="dialog__actions">
        <button ref={cancelRef} type="button" className="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={danger ? 'button button--danger' : 'button button--primary'}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
